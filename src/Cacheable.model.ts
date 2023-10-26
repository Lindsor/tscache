export type CacheInterface = Record<CacheName, CacheEntry<unknown>>;

// TODO: Add Observable handling.
export type CachedResponse<T> = Promise<T> | T;

export type CacheName = string;

export enum CacheWrapAs {
  OBSERVABLE,
  PROMISE,
  RAW,
}

export interface CacheEntry<T = unknown> {
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

export type MethodParamDecoratorReturn = (
  classTarget: Object,
  methodKey: string,
  propertyIndex: number,
) => void;
export type MethodParamDecorator = (...args: unknown[]) => MethodParamDecoratorReturn;

export type MethodDecoratorReturn = (
  classTarget: Object,
  methodKey: string,
  descriptor: PropertyDescriptor,
) => void;
export type MethodDecorator<T> = (options: T) => MethodDecoratorReturn;
