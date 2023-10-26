import 'reflect-metadata';
import { CacheKeyParam, Cacheable, EvictCache } from '../src';
import { CacheableBase } from '../src/CacheableBase';

jest.useFakeTimers();

class SimpleGlobalClass {
  private simpleCachedFunctionResponses: readonly number[] = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ];
  private countCall: number = -1;

  @Cacheable({
    cacheName: 'simpleCachedFunction',
  })
  simpleCachedFunction(): number {
    this.countCall += 1;
    return this.simpleCachedFunctionResponses[this.countCall];
  }

  @EvictCache({ evictAll: true })
  evictAll(): void {}
}

afterEach(() => {
  jest.restoreAllMocks();
  Cacheable.init({
    isEnabled: true,
    disabledCacheNames: [],
  });
});

describe('@Cacheable({ ... })', () => {
  test('returns same response until evicted', () => {
    const clazz = new SimpleGlobalClass();

    expect(clazz.simpleCachedFunction()).toBe(0);
    expect(clazz.simpleCachedFunction()).toBe(0);

    clazz.evictAll();

    expect(clazz.simpleCachedFunction()).toBe(1);
    expect(clazz.simpleCachedFunction()).toBe(1);
  });

  test('cache is global accross all instances', () => {
    const clazz = new SimpleGlobalClass();

    expect(clazz.simpleCachedFunction()).toBe(1);
    expect(clazz.simpleCachedFunction()).toBe(1);

    clazz.evictAll();

    expect(clazz.simpleCachedFunction()).toBe(0);
    expect(clazz.simpleCachedFunction()).toBe(0);
  });

  test('cache names cannot be reused', () => {
    try {
      const cacheName = 'sameName';

      // @ts-expect-error
      class SomeClass {
        @Cacheable({ cacheName: cacheName })
        someMethod() {}
      }

      // @ts-expect-error
      class SomeOtherClass {
        @Cacheable({ cacheName: cacheName })
        someMethod() {}
      }
    } catch {
      expect(true).toBeTruthy();
    }
  });

  test(`cache names cannot contain restricted character '${CacheableBase.cacheNameSuffix}'`, () => {
    try {
      // @ts-expect-error
      class SomeOtherClass {
        @Cacheable({
          cacheName: `restricted${CacheableBase.cacheNameSuffix}Characters`,
        })
        someMethod() {}
      }
    } catch {
      expect(true).toBeTruthy();
    }
  });

  test('cache can handle Promises', async () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({ cacheName: 'promiseResponse' })
      someMethod(): Promise<number> {
        this.countCall += 1;
        return Promise.resolve(
          this.simpleCachedFunctionResponses[this.countCall],
        );
      }

      @EvictCache({ evictAll: true })
      evict(): void {}
    }

    const clazz = new SomeClass();

    await expect(clazz.someMethod()).resolves.toBe(0);
    await expect(clazz.someMethod()).resolves.toBe(0);

    clazz.evict();

    await expect(clazz.someMethod()).resolves.toBe(1);
    await expect(clazz.someMethod()).resolves.toBe(1);
  });

  test('cache can handle delayInMs Promises', async () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'delayInMs',
        delayInMs: 1,
      })
      someMethod(): Promise<number> {
        this.countCall += 1;
        return Promise.resolve(
          this.simpleCachedFunctionResponses[this.countCall],
        );
      }
    }

    const clazz = new SomeClass();

    await expect(clazz.someMethod()).resolves.toBe(0);
    const cachedResponse = clazz.someMethod();
    jest.runAllTimers();
    await expect(cachedResponse).resolves.toBe(0);
  });

  test('when disabled after initialization dont run', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'isDisabled',
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    Cacheable.init({
      isEnabled: false,
      disabledCacheNames: [],
    });

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(2);
    expect(clazz.someMethod()).toBe(3);
    expect(clazz.someMethod()).toBe(4);
    expect(clazz.someMethod()).toBe(5);
    expect(clazz.someMethod()).toBe(6);
    expect(clazz.someMethod()).toBe(7);
    expect(clazz.someMethod()).toBe(8);
    expect(clazz.someMethod()).toBe(9);
  });

  test('when disabled before initialization dont run', () => {
    Cacheable.init({
      isEnabled: false,
      disabledCacheNames: [],
    });

    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'isDisabled',
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(2);
    expect(clazz.someMethod()).toBe(3);
    expect(clazz.someMethod()).toBe(4);
    expect(clazz.someMethod()).toBe(5);
    expect(clazz.someMethod()).toBe(6);
    expect(clazz.someMethod()).toBe(7);
    expect(clazz.someMethod()).toBe(8);
    expect(clazz.someMethod()).toBe(9);
  });

  test('when disabled names dont run', () => {
    Cacheable.init({
      isEnabled: true,
      disabledCacheNames: ['disabledCacheName'],
    });

    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'disabledCacheName',
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(2);
    expect(clazz.someMethod()).toBe(3);
    expect(clazz.someMethod()).toBe(4);
    expect(clazz.someMethod()).toBe(5);
    expect(clazz.someMethod()).toBe(6);
    expect(clazz.someMethod()).toBe(7);
    expect(clazz.someMethod()).toBe(8);
    expect(clazz.someMethod()).toBe(9);
  });

  test('cache takes arguments into account', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({ cacheName: 'allArgumentsCache' })
      someMethod(
        _arg1: number,
        _arg2: string,
        _arg3: {
          hello: string;
        },
      ): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod(0, 'hello', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(0, 'hello', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(1, 'hello', { hello: 'test' })).toBe(1);
    expect(clazz.someMethod(0, 'hello', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(0, 'goodbye', { hello: 'test' })).toBe(2);
    expect(clazz.someMethod(1, 'goodbye', { hello: 'test' })).toBe(3);
    expect(clazz.someMethod(0, 'goodbye', { hello: 'test' })).toBe(2);
    expect(clazz.someMethod(0, 'goodbye', { hello: 'test2' })).toBe(4);
  });

  test('cache returns new data on corrupt entry', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({ cacheName: 'corruptCache' })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(0);

    delete Cacheable._getCache()['corruptCache'].value;

    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(1);
  });

  test('cache takes tagged arguments into account if explicitParams:true', () => {
    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'useExplicitPrams',
        useExplicitPrams: true,
      })
      someMethod(
        @CacheKeyParam() _arg1: number,
        _arg2: string,
        @CacheKeyParam()
        _arg3: {
          hello: string;
        },
      ): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod(0, 'hello', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(0, 'hello', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(1, 'hello', { hello: 'test' })).toBe(1);
    expect(clazz.someMethod(0, 'hello', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(0, 'goodbye', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(1, 'goodbye', { hello: 'test' })).toBe(1);
    expect(clazz.someMethod(0, 'goodbye', { hello: 'test' })).toBe(0);
    expect(clazz.someMethod(0, 'goodbye', { hello: 'test2' })).toBe(2);
  });

  test('should expire on expiryInSeconds', () => {
    let currentMsTime = 1000;

    jest.spyOn(Date, 'now').mockImplementation(() => currentMsTime);

    class SomeClass {
      private simpleCachedFunctionResponses: readonly number[] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ];
      private countCall: number = -1;

      @Cacheable({
        cacheName: 'expiryInSeconds',
        expiryInSeconds: 15,
      })
      someMethod(): number {
        this.countCall += 1;
        return this.simpleCachedFunctionResponses[this.countCall];
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).toBe(0);
    expect(clazz.someMethod()).toBe(0);

    currentMsTime = currentMsTime + 15_000;

    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(1);

    currentMsTime = currentMsTime + 7_500;

    expect(clazz.someMethod()).toBe(1);
    expect(clazz.someMethod()).toBe(1);

    currentMsTime = currentMsTime + 8_500;

    expect(clazz.someMethod()).toBe(2);
    expect(clazz.someMethod()).toBe(2);
  });

  test('should give different object on shouldCloneDeep', () => {
    const originalObject1 = {
      foo: 'bar',
    };
    const originalObject2 = {
      foo: 'bar',
    };

    class SomeClass {
      @Cacheable({
        cacheName: 'shouldCloneDeep',
        shouldCloneDeep: true,
      })
      someMethod(): typeof originalObject1 {
        return originalObject1;
      }

      @Cacheable({
        cacheName: 'shouldNotCloneDeep',
        shouldCloneDeep: false,
      })
      someMethod2(): typeof originalObject2 {
        return originalObject2;
      }
    }

    const clazz = new SomeClass();

    expect(clazz.someMethod()).not.toBe(originalObject1);
    expect(clazz.someMethod()).not.toBe(originalObject2);
    expect(clazz.someMethod()).toEqual(originalObject1);
    expect(clazz.someMethod()).toEqual(originalObject2);

    expect(clazz.someMethod2()).not.toBe(originalObject1);
    expect(clazz.someMethod2()).toBe(originalObject2);
    expect(clazz.someMethod()).toEqual(originalObject1);
    expect(clazz.someMethod()).toEqual(originalObject2);
  });
});
