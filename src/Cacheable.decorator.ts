import {
  CacheName,
  CacheEntry,
  CacheableOptions,
  EvictCacheOptions,
  CacheWrapAs,
  CachedResponse,
  MethodParamDecorator,
  CacheableGlobalOptions,
  MethodDecorator,
  CacheInterface,
} from './Cacheable.model';
import { GlobalInMemoryCacheStorage } from './storage/GlobalInMemoryCacheStorage';
import { CacheableBase } from './CacheableBase';

let globalCache: CacheableBase;

export const CacheKeyParam: MethodParamDecorator = () => {
  return function (
    classTarget: Object,
    methodKey: string,
    parameterIndex: number,
  ): void {
    const propertyKey: string = `${methodKey}_argsKey`;
    const argsKeys: number[] =
      // @ts-ignore
      Reflect.getMetadata(propertyKey, classTarget) || [];

    argsKeys.unshift(parameterIndex);
    // @ts-ignore
    Reflect.defineMetadata(propertyKey, argsKeys, classTarget);
  };
};

/**
 * TODO: Rearchitecture the cache in the format:
 * {
 *   [cacheName]: {
 *     [cacheKey]: cacheEntry
 *   }
 * }
 * @param cacheOptions
 * @returns
 */
export const Cacheable: MethodDecorator<CacheableOptions> & {
  init: (globalOptions: CacheableGlobalOptions) => void;
  _getCache: () => CacheInterface;
} = (cacheOptions: CacheableOptions) => {
  if (!globalCache) {
    Cacheable.init({
      isEnabled: true,
      disabledCacheNames: [],
    });
  }

  if (!globalCache.isCachingEnabled(cacheOptions)) {
    return (
      _target: Object,
      _propertyKey: string,
      descriptor: PropertyDescriptor,
    ) => descriptor;
  }

  cacheOptions = globalCache.getDefaultCacheOptions(
    cacheOptions,
  ) as CacheableOptions;

  globalCache.createCacheName(cacheOptions.cacheName);

  return (
    classTarget: Object,
    methodKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    // TODO: Move to getter function
    const propertyKey: string = `${methodKey}_argsKey`;
    const originalMethod: Function = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      // Caching can be disabled dynamically so we need to check at runtime.
      if (!globalCache.isCachingEnabled(cacheOptions)) {
        return originalMethod.apply(this, args);
      }

      const argsKeys: number[] =
        // @ts-ignore
        Reflect.getMetadata(propertyKey, classTarget) || [];
      const key: CacheName = globalCache.getCacheKey(
        cacheOptions,
        argsKeys,
        args,
      );

      if (globalCache.isCacheEntryValid(cacheOptions, argsKeys, args)) {
        return globalCache.getWrappedCacheValue(key, cacheOptions);
      }

      const response: CachedResponse<unknown> = originalMethod.apply(
        this,
        args,
      );

      // TODO: Add Observable.

      if (response instanceof Promise) {
        return response.then((originalResponse) => {
          return (
            globalCache.addToCache(
              key,
              cacheOptions,
              originalResponse,
              CacheWrapAs.PROMISE,
            ) as CacheEntry<unknown>
          ).value;
        });
      }

      return (
        globalCache.addToCache(
          key,
          cacheOptions,
          response,
          CacheWrapAs.RAW,
        ) as CacheEntry<unknown>
      ).value;
    };

    return descriptor;
  };
};

// Used for storing the global cache object.
// TODO: Figure out a better way and/or allow user to choose
Cacheable.init = (globalOptions: CacheableGlobalOptions) => {
  globalCache = new CacheableBase<GlobalInMemoryCacheStorage>(
    new GlobalInMemoryCacheStorage(),
    globalOptions,
  );
};
Cacheable._getCache = () => GlobalInMemoryCacheStorage.getCache();

export const EvictCache: MethodDecorator<EvictCacheOptions> = (
  evictOptions: EvictCacheOptions,
) => {
  evictOptions = globalCache.getDefaultCacheEvictOptions(evictOptions);

  return (
    _target: Object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod: Function = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      globalCache.evictCache(evictOptions);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};

export const EvictCacheAll: MethodDecorator<void> = () =>
  EvictCache({ evictAll: true });
