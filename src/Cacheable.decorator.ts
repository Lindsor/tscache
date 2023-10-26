import { Observable, map } from 'rxjs';
import {
  CacheEntry,
  CacheInterface,
  CacheName,
  CacheWrapAs,
  CacheableBase,
  CacheableGlobalOptions,
  CacheableOptions,
  CachedResponse,
  EvictCacheOptions,
  GlobalInMemoryCacheStorage,
  MethodDecorator,
  MethodParamDecorator,
} from './';

let globalCache: CacheableBase;

const ensureGlobalCache = (
  globalOptions: CacheableGlobalOptions,
): CacheableBase => {
  if (!globalCache) {
    Cacheable.init(globalOptions);
  }

  return globalCache;
};

const getMethodPropertyKey = (methodName: string): string => {
  return `${methodName}_argsKey`;
};

export const CacheKeyParam: MethodParamDecorator = () => {
  return function (
    classTarget: Object,
    methodKey: string,
    parameterIndex: number,
  ): void {
    const propertyKey: string = getMethodPropertyKey(methodKey);
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
  ensureGlobalCache({
    isEnabled: true,
    disabledCacheNames: [],
  });

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
    const propertyKey: string = getMethodPropertyKey(methodKey);
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

      if (response instanceof Observable) {
        return response.pipe(
          map((originalResponse) => {
            return (
              globalCache.addToCache(
                key,
                cacheOptions,
                originalResponse,
                CacheWrapAs.OBSERVABLE,
              ) as CacheEntry<unknown>
            ).value;
          }),
        );
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
Cacheable.init = (globalOptions: CacheableGlobalOptions) => {
  return new CacheableBase<GlobalInMemoryCacheStorage>(
    new GlobalInMemoryCacheStorage(),
    globalOptions,
  );
};
Cacheable._getCache = () => GlobalInMemoryCacheStorage.getCache();

export const EvictCache: MethodDecorator<EvictCacheOptions> = (
  evictOptions: EvictCacheOptions,
) => {
  ensureGlobalCache({
    isEnabled: true,
    disabledCacheNames: [],
  });

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
