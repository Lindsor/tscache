import {
  CacheEntry,
  CacheInterface,
  CacheName,
  CacheStorageBase,
  CacheableBase,
} from '../';

let __CACHE__: CacheInterface = {};

export class GlobalInMemoryCacheStorage extends CacheStorageBase {
  static getCache(): CacheInterface {
    return __CACHE__;
  }

  set<T>(key: string, item: CacheEntry<T>): CacheEntry<T> {
    __CACHE__[key] = item;
    return item;
  }

  get<T>(cacheKey: CacheName): CacheEntry<T | null> {
    return __CACHE__[cacheKey] as CacheEntry<T | null>;
  }

  getKeys(): string[] {
    return Object.keys(__CACHE__);
  }

  clearStorage(): void | Promise<void> {
    __CACHE__ = {};
  }

  clearStorageKeys(keys: string[]): void | Promise<void> {
    keys.forEach((evictKey: CacheName) => {
      for (let key in __CACHE__) {
        if (CacheableBase.isCacheNameInKey(evictKey, key)) {
          delete __CACHE__[key];
        }
      }
    });
  }

  clearStorageKeysByGroups(groups: string[]): void | Promise<void> {
    for (let key in __CACHE__) {
      const isInEvictGroup: boolean = groups.some(
        (evictGroup: CacheName) => __CACHE__[key].groups?.includes(evictGroup),
      );

      if (!isInEvictGroup) {
        continue;
      }

      delete __CACHE__[key];
    }
  }
}
