import { CacheEntry, CacheName } from '../';

export abstract class CacheStorageBase {
  abstract set<T>(
    key: string,
    item: CacheEntry<T>,
  ): Promise<CacheEntry<T>> | CacheEntry<T>;
  abstract get<T>(
    cacheKey: CacheName,
  ): Promise<CacheEntry<T | null>> | CacheEntry<T | null>;
  abstract getKeys(): Promise<string[]> | string[];
  abstract clearStorage(): Promise<void> | void;
  abstract clearStorageKeys(keys: string[]): Promise<void> | void;
  abstract clearStorageKeysByGroups(groups: string[]): Promise<void> | void;
}
