import 'reflect-metadata';
import { CacheKeyParam, Cacheable, EvictCache, EvictCacheAll } from '../src';

jest.useFakeTimers();

afterEach(() => {
  jest.restoreAllMocks();
  Cacheable.init({
    isEnabled: true,
    disabledCacheNames: [],
  });
});

describe('@EvictCache({ ... })', () => {
  test('should evict the cache', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'evictable',
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }

      @EvictCache({
        evictAll: true,
      })
      evict() {}
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(0);

    clazz.evict();

    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(1);
  });

  test('should evict all the cache', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;
      private reverseCountCall: number =
        this.simpleCachedFunctionResponses.length;

      @Cacheable({
        cacheName: 'evictAll',
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }

      @Cacheable({
        cacheName: 'evictAllOther',
      })
      someOtherMethod(): number {
        this.reverseCountCall--;
        return this.simpleCachedFunctionResponses[this.reverseCountCall];
      }

      @EvictCacheAll()
      evictAll() {}
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(0);

    expect(clazz.someOtherMethod()).toBe(9);
    expect(clazz.someOtherMethod()).toBe(9);

    clazz.evictAll();

    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(1);

    expect(clazz.someOtherMethod()).toBe(8);
    expect(clazz.someOtherMethod()).toBe(8);
  });

  test('should evict the caches with specific names only', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'evictByName',
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }

      @EvictCache({
        cacheNames: ['wrongName1', 'wrongName2'],
      })
      evictByWrongName() {}

      @EvictCache({
        cacheNames: ['wrongName3', 'evictByName'],
      })
      evictByCorrectName() {}
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(0);

    clazz.evictByWrongName();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(0);

    clazz.evictByCorrectName();

    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(1);
  });

  test('should evict the caches with specific including parameters', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'evictByNameWithExplicit',
        useExplicitParams: true,
      })
      someMethod(@CacheKeyParam() _accountId: string): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }

      @EvictCache({
        evictAll: false,
        cacheNames: ['wrongName4', 'wrongName5'],
      })
      evictByWrongName() {}

      @EvictCache({
        evictAll: false,
        cacheNames: ['wrongName6', 'evictByNameWithExplicit'],
      })
      evictByCorrectName() {}
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod('1')).toBe(0);
    expect(clazz.someMethod('2')).toBe(1);

    clazz.evictByWrongName();

    expect(clazz.someMethod('1')).toBe(0);
    expect(clazz.someMethod('2')).toBe(1);

    clazz.evictByCorrectName();

    expect(clazz.someMethod('1')).toBe(2);
    expect(clazz.someMethod('2')).toBe(3);
  });

  test('should evict the caches with specific including parameters', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'evictByGroup',
        groups: ['customer'],
        useExplicitParams: true,
      })
      someMethod(@CacheKeyParam() _accountId: string): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }

      @EvictCache({
        evictAll: false,
        groups: ['customer1'],
        cacheNames: ['wrongName4', 'wrongName5'],
      })
      evictByWrongName() {}

      @EvictCache({
        evictAll: false,
        groups: ['wrongName6', 'customer'],
      })
      evictByCorrectName() {}
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod('1')).toBe(0);
    expect(clazz.someMethod('2')).toBe(1);

    clazz.evictByWrongName();

    expect(clazz.someMethod('1')).toBe(0);
    expect(clazz.someMethod('2')).toBe(1);

    clazz.evictByCorrectName();

    expect(clazz.someMethod('1')).toBe(2);
    expect(clazz.someMethod('2')).toBe(3);
  });

  test('do nothing if no options match', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'evictByWrongName',
        groups: ['customer'],
        useExplicitParams: true,
      })
      someMethod(@CacheKeyParam() _accountId: string): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }

      @EvictCache({
        evictAll: false,
      })
      evictByWrongName() {}
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod('1')).toBe(0);
    expect(clazz.someMethod('2')).toBe(1);

    clazz.evictByWrongName();

    expect(clazz.someMethod('1')).toBe(0);
    expect(clazz.someMethod('2')).toBe(1);
  });
});
