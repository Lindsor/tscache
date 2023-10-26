import { klona } from 'klona';
import type { Observable } from 'rxjs';
import { delay, of } from 'rxjs';
import {
  CacheEntry,
  CacheName,
  CacheStorageBase,
  CacheWrapAs,
  CacheableGlobalOptions,
  CacheableOptions,
  EvictCacheOptions,
} from './';

export class CacheableBase<
  StorageType extends CacheStorageBase = CacheStorageBase,
> {
  public static readonly cacheNameSuffix = '$$';

  private usedCacheNames: CacheName[] = [];

  private readonly storage: Readonly<StorageType>;
  private readonly options: Readonly<CacheableGlobalOptions>;

  static isCacheNameInKey(cacheName: CacheName, cacheKey: CacheName): boolean {
    if (
      cacheKey === cacheName ||
      cacheKey.startsWith(`${cacheName}${CacheableBase.cacheNameSuffix}`)
    ) {
      return true;
    }

    return false;
  }

  constructor(storage: StorageType, globalOptions: CacheableGlobalOptions) {
    this.storage = storage;
    this.options = globalOptions;
  }

  addToCache<T>(
    cacheKey: CacheName,
    cacheOptions: CacheableOptions,
    cacheValue: T,
    wrapAs: CacheWrapAs,
  ): ReturnType<CacheStorageBase['set']> {
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

    return this.storage.set(cacheKey, cacheEntry);
  }

  getWrappedCacheValue<T = unknown>(
    cacheKey: CacheName,
    cacheOptions: CacheableOptions,
  ): Observable<T> | Promise<T> | T | Promise<Observable<T> | Promise<T> | T> {
    const cacheEntry: CacheEntry<T> | Promise<CacheEntry<T>> =
      this.storage.get<T>(cacheKey);

    if (cacheEntry instanceof Promise) {
      return cacheEntry.then((cacheEntry: CacheEntry<T>) =>
        this.getWrappedCacheValueSync<T>(cacheEntry, cacheOptions),
      );
    }

    return this.getWrappedCacheValueSync<T>(cacheEntry, cacheOptions);
  }

  createCacheName(cacheName: CacheName): void {
    const isDev: boolean = !!this.options.isDev;

    if (this.usedCacheNames.includes(cacheName)) {
      const message: string = `Duplicate 'cacheName' declared in @Cacheable decorator: ${cacheName}`;
      if (isDev) throw new Error(message);
    } else {
      this.usedCacheNames.push(cacheName);
    }

    if (cacheName.includes(CacheableBase.cacheNameSuffix)) {
      const message: string = `Invalid character, cacheName cannot contain characers '${CacheableBase.cacheNameSuffix}'`;
      if (isDev) throw new Error(message);
    }
  }

  getCacheKey(
    cacheOptions: CacheableOptions,
    argsKey?: number[],
    functionArgs?: unknown[],
  ): CacheName {
    let key: CacheName = cacheOptions.cacheName;

    if (!cacheOptions.useExplicitParams && !!functionArgs?.length) {
      key += `${CacheableBase.cacheNameSuffix}${JSON.stringify(functionArgs)}`;
    } else if (Array.isArray(argsKey) && !!functionArgs?.length) {
      key += CacheableBase.cacheNameSuffix;
      argsKey.forEach((argIndex: number) => {
        let argValue: unknown = functionArgs[argIndex];

        if (typeof argValue !== 'string') {
          argValue = JSON.stringify(argValue);
        }

        key += `_${argValue}`;
      });
    }

    return key;
  }

  getDefaultCacheOptions(
    overrideOptions: CacheableOptions,
  ): Required<Omit<CacheableOptions, 'cacheName' | 'argsKey' | 'groups'>> {
    return {
      expiryInSeconds: false,
      delayInMs: false,
      shouldCloneDeep: true,
      useExplicitParams: false,
      ...klona(this.options),
      ...overrideOptions,
    };
  }

  getDefaultCacheEvictOptions(
    overrideOptions: EvictCacheOptions,
  ): Required<EvictCacheOptions> {
    return {
      evictAll: false,
      cacheNames: [],
      groups: [],
      ...overrideOptions,
    };
  }

  isCachingEnabled(cacheOptions: CacheableOptions): boolean {
    if (!this.options?.isEnabled) {
      return false;
    }

    if (this.options?.disabledCacheNames?.includes(cacheOptions.cacheName)) {
      return false;
    }

    return true;
  }

  isCacheEntryValid(
    cacheOptions: CacheableOptions,
    argsKeys: number[],
    functionArgs: unknown[],
  ): Promise<boolean> | boolean {
    const key: CacheName = this.getCacheKey(
      cacheOptions,
      argsKeys,
      functionArgs,
    );

    const cacheEntry = this.storage.get(key);

    if (cacheEntry instanceof Promise) {
      return cacheEntry.then((cacheEntry: CacheEntry<unknown>) => {
        return this.isCacheEntryValidSync(cacheEntry, cacheOptions);
      });
    }

    return this.isCacheEntryValidSync(cacheEntry, cacheOptions);
  }

  evictCache(evictOptions: EvictCacheOptions): void | Promise<void> {
    if (evictOptions.evictAll) {
      return this.storage.clearStorage();
    }

    if (!!evictOptions.cacheNames?.length) {
      return this.storage.clearStorageKeys(evictOptions.cacheNames);
    }

    if (evictOptions.groups?.length) {
      return this.storage.clearStorageKeysByGroups(evictOptions.groups);
    }

    return;
  }

  private getWrappedCacheValueSync<T>(
    cacheEntry: CacheEntry<T>,
    cacheOptions: CacheableOptions,
  ): T | Observable<T> | Promise<T> {
    let cacheValue: T = cacheEntry.value;

    if (cacheOptions.shouldCloneDeep) {
      cacheValue = klona(cacheValue);
    }

    if (cacheEntry.wrapAs === CacheWrapAs.OBSERVABLE) {
      let response$: Observable<T> = of(cacheValue);

      if (typeof cacheOptions.delayInMs === 'number') {
        response$ = response$.pipe(delay(cacheOptions.delayInMs));
      }

      return response$;
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
  }

  private isCacheEntryValidSync(
    cacheEntry: CacheEntry<unknown>,
    cacheOptions: CacheableOptions,
  ): boolean {
    if (!cacheEntry) {
      return false;
    }

    if (!('value' in cacheEntry)) {
      return false;
    }

    if (typeof cacheOptions.expiryInSeconds === 'number') {
      const MILLISECONDS_TO_SECONDS = 1_000;

      const nowInMiliseconds: number = Date.now();
      const timeCachedInMilliseconds: number = cacheEntry.populatedAt;

      const diffInMilliseconds: number =
        nowInMiliseconds - timeCachedInMilliseconds;

      const diffInSeconds: number =
        diffInMilliseconds / MILLISECONDS_TO_SECONDS;

      if (diffInSeconds >= cacheOptions.expiryInSeconds) {
        return false;
      }
    }

    return true;
  }
}
