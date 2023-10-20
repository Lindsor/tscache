import { klona } from 'klona';

export const CACHE_KEY_SUFFIX = '$$';

// TODO: Add Observable handling.
type CachedResponse<T> = Promise<T> | T;

type CacheName = string;

enum CacheWrapAs {
  OBSERVABLE,
  PROMISE,
  RAW,
}

interface CacheEntry<T = unknown> {
  key: CacheName;
  groups?: CacheName[];
  populatedAt: number;
  wrapAs: CacheWrapAs;
  value: T;
}

export interface CacheableOptions {
  cacheName: string;
  groups?: CacheName[];
  useExplicitPrams?: boolean;
  expiryInSeconds?: number | false;
  delayInMs?: number | false;
  shouldCloneDeep?: boolean;
}

export interface CacheableGlobalOptions
  extends Omit<CacheableOptions, 'cacheName' | 'groups'> {
  isEnabled: boolean;
  disabledCacheNames: CacheName[];
}

export interface EvictCacheOptions {
  evictAll?: boolean;
  cacheNames?: string[];
  groups?: string[];
}

type MethodParamDecoratorReturn = (
  classTarget: Object,
  methodKey: string,
  propertyIndex: number,
) => void;
type MethodParamDecorator = (...args: unknown[]) => MethodParamDecoratorReturn;

type MethodDecoratorReturn = (
  classTarget: Object,
  methodKey: string,
  descriptor: PropertyDescriptor,
) => void;
type MethodDecorator<T> = (options: T) => MethodDecoratorReturn;

let __CACHE__: Record<CacheName, CacheEntry<unknown>> = {};
const USED_CACHE_NAMES: CacheName[] = [];

const defaultCacheOptions = (
  options: CacheableOptions,
): Required<Omit<CacheableOptions, 'cacheName' | 'argsKey' | 'groups'>> => ({
  expiryInSeconds: false,
  delayInMs: false,
  shouldCloneDeep: true,
  useExplicitPrams: false,
  ...Cacheable.getGlobalOptions(),
  ...options,
});

const defaultEvictCacheOptions = (
  options: EvictCacheOptions,
): Required<EvictCacheOptions> => ({
  evictAll: false,
  cacheNames: [],
  groups: [],
  ...options,
});

const getCacheOptionsKey = (
  cacheOptions: CacheableOptions,
  argsKey: number[],
  functionArgs: unknown[],
): CacheName => {
  let key: CacheName = cacheOptions.cacheName;

  if (!cacheOptions.useExplicitPrams && !!functionArgs?.length) {
    key += `${CACHE_KEY_SUFFIX}${JSON.stringify(functionArgs)}`;
  } else if (Array.isArray(argsKey) && !!functionArgs?.length) {
    key += CACHE_KEY_SUFFIX;
    argsKey.forEach((argIndex: number) => {
      let argValue: unknown = functionArgs[argIndex];

      if (typeof argValue !== 'string') {
        argValue = JSON.stringify(argValue);
      }

      key += `_${argValue}`;
    });
  }

  return key;
};

const addToCache = <T = unknown>(
  cacheKey: CacheName,
  cacheOptions: CacheableOptions,
  cacheValue: T,
  wrapAs: CacheWrapAs,
): CacheEntry<T> => {
  if (cacheOptions.shouldCloneDeep) {
    cacheValue = klona(cacheValue);
  }

  const cacheEntry: CacheEntry<T> = {
    key: cacheKey,
    groups: cacheOptions.groups,
    populatedAt: Date.now(),
    value: cacheValue,
    wrapAs,
  };

  // TODO: Modify for different storage options
  __CACHE__[cacheKey] = cacheEntry;

  return cacheEntry;
};

const isCacheNameInKey = (
  cacheName: CacheName,
  cacheKey: CacheName,
): boolean => {
  if (
    cacheKey === cacheName ||
    cacheKey.startsWith(`${cacheName}${CACHE_KEY_SUFFIX}`)
  ) {
    return true;
  }

  return false;
};

const isCacheEntryValid = (
  cacheOptions: CacheableOptions,
  argsKeys: number[],
  functionArgs: unknown[],
): boolean => {
  const key: CacheName = getCacheOptionsKey(
    cacheOptions,
    argsKeys,
    functionArgs,
  );

  if (!(key in __CACHE__)) {
    return false;
  }

  if (!('value' in __CACHE__[key])) {
    return false;
  }

  if (typeof cacheOptions.expiryInSeconds === 'number') {
    const MILLISECONDS_TO_SECONDS = 1_000;

    const nowInMiliseconds: number = Date.now();
    const timeCachedInMilliseconds: number = __CACHE__[key].populatedAt;

    const diffInMilliseconds: number =
      nowInMiliseconds - timeCachedInMilliseconds;

    const diffInSeconds: number = diffInMilliseconds / MILLISECONDS_TO_SECONDS;

    if (diffInSeconds >= cacheOptions.expiryInSeconds) {
      return false;
    }
  }

  return true;
};

const getWrappedCacheValue = <T = unknown>(
  cacheKey: CacheName,
  cacheOptions: CacheableOptions,
): CachedResponse<T> => {
  const cacheEntry: CacheEntry<T> = __CACHE__[cacheKey] as CacheEntry<T>;

  let cacheValue: T = cacheEntry.value;

  if (cacheOptions.shouldCloneDeep) {
    cacheValue = klona(cacheValue);
  }

  if (cacheEntry.wrapAs === CacheWrapAs.OBSERVABLE) {
    // TODO: Implement
  }

  if (cacheEntry.wrapAs === CacheWrapAs.PROMISE) {
    if (typeof cacheOptions.delayInMs === 'number') {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(cacheValue);
        }, cacheOptions.delayInMs as number);
      });
    }

    return Promise.resolve(cacheValue);
  }

  return cacheValue;
};

const isCachingEnabled = (cacheOptions: CacheableOptions): boolean => {
  if (!Cacheable._options.isEnabled) {
    return false;
  }

  if (
    Cacheable._options?.disabledCacheNames?.includes(cacheOptions.cacheName)
  ) {
    return false;
  }

  return true;
};

export const CacheKeyParam: MethodParamDecorator = () => {
  return function (
    classTarget: Object,
    methodKey: string,
    parameterIndex: number,
  ): void {
    const propertyKey: string = `${methodKey}_argsKey`;
    const argsKeys: number[] =
      Reflect.getMetadata(propertyKey, classTarget) || [];

    argsKeys.unshift(parameterIndex);
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
  getCache: () => typeof __CACHE__;
  getGlobalOptions: () => CacheableGlobalOptions;
  disable: () => void;
  enable: () => void;
  disableCacheNames: (cacheNames: CacheName[]) => void;
  _options: CacheableGlobalOptions;
} = (cacheOptions: CacheableOptions) => {
  if (!isCachingEnabled(cacheOptions)) {
    return (
      _target: Object,
      _propertyKey: string,
      descriptor: PropertyDescriptor,
    ) => descriptor;
  }

  cacheOptions = defaultCacheOptions(cacheOptions) as CacheableOptions;

  // TODO: Throw error in dev turn off caching in prod
  if (USED_CACHE_NAMES.includes(cacheOptions.cacheName)) {
    throw new Error(
      `Duplicate 'cacheName' declared in @Cacheable decorator: ${cacheOptions.cacheName}`,
    );
  }

  // TODO: Throw error in dev turn off caching in prod
  if (cacheOptions.cacheName.includes(CACHE_KEY_SUFFIX)) {
    throw new Error(
      `Invalid character, cacheName cannot contain characers '${CACHE_KEY_SUFFIX}'`,
    );
  }

  USED_CACHE_NAMES.push(cacheOptions.cacheName);

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
      if (!isCachingEnabled(cacheOptions)) {
        return originalMethod.apply(this, args);
      }

      const argsKeys: number[] =
        Reflect.getMetadata(propertyKey, classTarget) || [];
      const key: CacheName = getCacheOptionsKey(cacheOptions, argsKeys, args);

      if (isCacheEntryValid(cacheOptions, argsKeys, args)) {
        return getWrappedCacheValue(key, cacheOptions);
      }

      const response: CachedResponse<unknown> = originalMethod.apply(
        this,
        args,
      );

      // TODO: Add Observable.

      if (response instanceof Promise) {
        return response.then((originalResponse) => {
          return addToCache(
            key,
            cacheOptions,
            originalResponse,
            CacheWrapAs.PROMISE,
          ).value;
        });
      }

      return addToCache(key, cacheOptions, response, CacheWrapAs.RAW).value;
    };

    return descriptor;
  };
};

// Used for storing the global cache object.
// TODO: Figure out a better way and/or allow user to choose
Cacheable.getCache = () => __CACHE__;
Cacheable._options = {
  isEnabled: true,
  disabledCacheNames: [],
};
Cacheable.getGlobalOptions = () => Cacheable._options;
Cacheable.disable = () => {
  Cacheable._options.isEnabled = false;
};
Cacheable.enable = () => {
  Cacheable._options.isEnabled = true;
};
Cacheable.disableCacheNames = (cacheNames: CacheName[]) => {
  Cacheable._options.disabledCacheNames = cacheNames;
};

export const EvictCache: MethodDecorator<EvictCacheOptions> = (
  evictOptions: EvictCacheOptions,
) => {
  evictOptions = defaultEvictCacheOptions(evictOptions);

  return (
    _target: Object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod: Function = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      // TODO: Add implementation specific
      if (evictOptions.evictAll) {
        __CACHE__ = {};

        return originalMethod.apply(this, args);
      }

      if (!!evictOptions.cacheNames?.length) {
        evictOptions.cacheNames.forEach((evictKey: CacheName) => {
          for (let key in __CACHE__) {
            if (isCacheNameInKey(evictKey, key)) {
              delete __CACHE__[key];
            }
          }
        });
      }

      if (evictOptions.groups?.length) {
        for (let key in __CACHE__) {
          const isInEvictGroup: boolean = evictOptions.groups.some(
            (evictGroup: CacheName) =>
              __CACHE__[key].groups?.includes(evictGroup),
          );

          if (!isInEvictGroup) {
            continue;
          }

          delete __CACHE__[key];
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};

export const EvictCacheAll: MethodDecorator<void> = () =>
  EvictCache({ evictAll: true });
