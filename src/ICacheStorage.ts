
export interface CacheStorageBase {

  set<T>(key: string, item: T): Promise<T>;
  get(): Promise<any>;
}
