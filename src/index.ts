/**
 * `EffectRegistry<T>` is the global registry of effects.
 * Users can extend this interface (via declaration merging) to register custom effects.
 * Each key defines an effect, and its associated type is the data type of the effect.
 * @typeParam T The type returned when the effect is performed.
 */
export interface EffectRegistry<out T> {
  async: Promise<T>;
}

/**
 * `EffectKey` is the union of all the effect keys registered in `EffectRegistry`,
 * i.e. the upper bound for effect rows.
 */
export type EffectKey = keyof EffectRegistry<unknown>;

/**
 * `EffectData<Key, T>` is the data type associated with each effect in `Key`.
 * It distributes over `Key`, i.e. `EffectData<X | Y, T> = EffectData<X, T> | EffectData<Y, T>`.
 */
export type EffectData<Key extends EffectKey, T> = EffectRegistry<T>[Key];

/**
 * `Effect<Key, T>` is the type of effects that return `T` when performed.
 * It distributes over `Key`, i.e. `Effect<X | Y, T> = Effect<X, T> | Effect<Y, T>`.
 */
export type Effect<Key extends EffectKey, T> =
  Key extends unknown ?
    Readonly<{
      key: Key;
      data: EffectData<Key, T>;
    }>
  : never;

/**
 * `Eff<T, Row>` is the type of effectful computations that return `T` and may perform
 * effects in `Row`.
 *
 * NOTE:
 * - A computation cannot be run twice.
 * - Functions that take computations usually "consume" them, i.e. once a computation is passed
 *   to such a function, it cannot be used again.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Eff<T, Row extends EffectKey = never> = Generator<Effect<Row, any>, T, any>;

/**
 * Creates a computation that performs a single effect.
 * @param effect The effect to perform.
 * @returns A computation that performs the given effect.
 */
export function* perform<Key extends EffectKey, T>(effect: Effect<Key, T>): Eff<T, Key> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return yield effect;
}

/**
 * Transforms the return value of a computation with a function.
 * @param comp The computation to transform.
 * @param func The function that transforms the return value of the computation.
 * @returns A computation that returns the transformed value.
 */
export function* map<Row extends EffectKey, T, U>(
  comp: Eff<T, Row>,
  func: (value: T) => U,
): Eff<U, Row> {
  const value = yield* comp;
  return func(value);
}

/**
 * Creates a pure computation that does not perform any effects and returns the given value.
 * @param value The value to return.
 * @returns A pure computation.
 */
export function* pure<T>(value: T): Eff<T> {
  return value;
}

/**
 * Creates a computation that does not perform any effects and throws the given error.
 * @param error The error to throw.
 * @returns A computation that throws the given error.
 */
export function* abort(error: unknown): Eff<never> {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw error;
}

/**
 * Composes (or chains) two computations sequentially, like `Promise.prototype.then`.
 * It calls `onReturn` if the first computation returns, and `onThrow` if it throws.
 * @param comp The first computation.
 * @param onReturn The function that takes the value returned by the first computation and returns a
 * subsequent computation.
 * @param onThrow The function that takes the error thrown by the first computation and returns a
 * subsequent computation. If omitted, the error is propagated as-is.
 * @returns A composed computation.
 */
export function* bind<Row extends EffectKey, T, U>(
  comp: Eff<T, Row>,
  onReturn: (value: T) => Eff<U, Row>,
  onThrow?: (error: unknown) => Eff<U, Row>,
): Eff<U, Row> {
  let value;
  if (onThrow) {
    try {
      value = yield* comp;
    } catch (error) {
      return yield* onThrow(error);
    }
  } else {
    // behaves as if onThrow = abort, but skips the redundant catch-and-rethrow
    value = yield* comp;
  }
  return yield* onReturn(value);
}

/**
 * `Handler<Key, T>` is the type of effect handlers.
 * An effect handler takes an effect performed by a computation, handles it, and determines whether
 * to resume the computation (with a value) or abort it (with an error).
 * It distributes over `Key`, i.e. `Handler<X | Y, T> = Handler<X, T> | Handler<Y, T>`.
 */
export type Handler<Key extends EffectKey, T> =
  Key extends unknown ?
    <S>(effect: Effect<Key, S>, resume: (value: S) => T, abort: (error: unknown) => T) => T
  : never;

/**
 * `HandlerRecord<Row, T>` is the type of sets of effect handlers, one for each effect in `Row`.
 */
export type HandlerRecord<Row extends EffectKey, T> = Readonly<{
  [Key in Row]: Handler<Key, T>;
}>;

/**
 * Runs an effectful computation.
 * @param comp The effectful computation to run.
 * @param onReturn The function that handles the value returned by the computation.
 * @param onThrow The function that handles the error thrown by the computation.
 * @param handlers The set of effect handlers for the effects performed by the computation.
 * NOTE: handlers should not throw; instead, they should call their third argument `abort` to
 * properly abort the computation.
 * @returns The value returned by `onReturn` or `onThrow`.
 */
export function run<Row extends EffectKey, T, U>(
  comp: Eff<T, Row>,
  onReturn: (value: T) => U,
  onThrow: (error: unknown) => U,
  handlers: HandlerRecord<Row, U>,
): U {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onResume(value?: any): U {
    let res;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      res = comp.next(value);
    } catch (err) {
      return onThrow(err);
    }
    if (res.done) {
      return onReturn(res.value);
    }
    return onYield(res.value);
  }

  function onAbort(error: unknown): U {
    let res;
    try {
      res = comp.throw(error);
    } catch (err) {
      return onThrow(err);
    }
    if (res.done) {
      return onReturn(res.value);
    }
    return onYield(res.value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onYield(effect: Effect<Row, any>): U {
    // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
    const handler = handlers[effect.key as Row];
    let done = false;
    return handler(
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
      effect as Effect<never, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (value: any) => {
        if (done) {
          throw new Error("cannot resume; already resumed or aborted");
        }
        done = true;
        return onResume(value);
      },
      (error: unknown) => {
        if (done) {
          throw new Error("cannot abort; already resumed or aborted");
        }
        done = true;
        return onAbort(error);
      },
    );
  }

  return onResume();
}

/**
 * Handles a subset of the effects performed by a computation.
 * @param comp The effectful computation.
 * @param handlers The set of effect handlers for a subset of the effects performed by the
 * computation.
 * NOTE: handlers should not throw; instead, they should call their third argument `abort` to
 * properly abort the computation.
 * @returns A wrapped computation that performs the remaining effects.
 */
export function* handle<RowA extends EffectKey, RowB extends EffectKey, T>(
  comp: Eff<T, RowA | NoInfer<RowB>>,
  handlers: HandlerRecord<RowA, Eff<T, RowB>>,
): Eff<T, RowB> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onResume(value?: any): Eff<T, RowB> {
    let res;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      res = comp.next(value);
    } catch (err) {
      return abort(err);
    }
    if (res.done) {
      return pure(res.value);
    }
    return onYield(res.value);
  }

  function onAbort(error: unknown): Eff<T, RowB> {
    let res;
    try {
      res = comp.throw(error);
    } catch (err) {
      return abort(err);
    }
    if (res.done) {
      return pure(res.value);
    }
    return onYield(res.value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onYield(effect: Effect<RowA | RowB, any>): Eff<T, RowB> {
    // NOTE: `effect.key in handlers` does not always imply `effect.key: RowA` because of subtyping,
    // but we assume so here for convenience.
    // eslint-disable-next-line @susisu/safe-typescript/no-unsafe-object-property-check
    if (effect.key in handlers) {
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
      const handler = handlers[effect.key as RowA];
      let done = false;
      return handler(
        // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
        effect as Effect<never, any>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (value: any) => {
          if (done) {
            throw new Error("cannot resume; already resumed or aborted");
          }
          done = true;
          return onResume(value);
        },
        (error: unknown) => {
          if (done) {
            throw new Error("cannot abort; already resumed or aborted");
          }
          done = true;
          return onAbort(error);
        },
      );
    }
    // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
    return bind(perform(effect as Effect<RowB, any>), onResume, onAbort);
  }

  return yield* onResume();
}

/**
 * `Interpreter<Key, Row>` is the type of interpreters.
 * An interpreter takes an effect performed by a computation, handles it by (optionally) translating
 * it into other effects, and returns a value to resume the computation or throws an error to abort
 * it.
 * It distributes over `Key`, i.e. `Interpreter<X | Y, Row> = Interpreter<X, Row> | Interpreter<Y, Row>`.
 */
export type Interpreter<Key extends EffectKey, Row extends EffectKey> =
  Key extends unknown ? <S>(effect: Effect<Key, S>) => Eff<S, Row> : never;

/**
 * `InterpreterRecord<RowA, RowB>` is the type of sets of interpreters, one for each effect in
 * `RowA`.
 */
export type InterpreterRecord<RowA extends EffectKey, RowB extends EffectKey> = Readonly<{
  [Key in RowA]: Interpreter<Key, RowB>;
}>;

/**
 * Interprets a subset of the effects performed by a computation.
 * @param comp The effectful computation.
 * @param interpreters The set of interpreters for a subset of the effects performed by the
 * computation.
 * @returns A wrapped computation that performs the remaining effects and the effects introduced by
 * the interpreters.
 */
export function* interpret<RowA extends EffectKey, RowB extends EffectKey, T>(
  comp: Eff<T, RowA | NoInfer<RowB>>,
  interpreters: InterpreterRecord<RowA, RowB>,
): Eff<T, RowB> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onResume(value?: any): Eff<T, RowB> {
    let res;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      res = comp.next(value);
    } catch (err) {
      return abort(err);
    }
    if (res.done) {
      return pure(res.value);
    }
    return onYield(res.value);
  }

  function onAbort(error: unknown): Eff<T, RowB> {
    let res;
    try {
      res = comp.throw(error);
    } catch (err) {
      return abort(err);
    }
    if (res.done) {
      return pure(res.value);
    }
    return onYield(res.value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onYield(effect: Effect<RowA | RowB, any>): Eff<T, RowB> {
    // NOTE: `effect.key in interpreters` does not always imply `effect.key: RowA` because of
    // subtyping, but we assume so here for convenience.
    // eslint-disable-next-line @susisu/safe-typescript/no-unsafe-object-property-check
    if (effect.key in interpreters) {
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
      const interpreter = interpreters[effect.key as RowA];
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
      return bind(interpreter(effect as Effect<never, any>), onResume, onAbort);
    }
    // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
    return bind(perform(effect as Effect<RowB, any>), onResume, onAbort);
  }

  return yield* onResume();
}

/**
 * Runs a synchronous computation that has no uninterpreted effects.
 * @param comp The computation to run.
 * @returns The value returned by the computation.
 */
export function runSync<T>(comp: Eff<T>): T {
  return run(
    comp,
    (value) => value,
    (error) => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error;
    },
    {},
  );
}

/**
 * Performs an `async` effect to wait for a promise.
 * @param promise The promise to wait for.
 * @returns A computation that waits for the promise and returns its resolved value.
 */
export function waitFor<T>(promise: Promise<T>): Eff<Awaited<T>, "async"> {
  return perform({
    key: "async",
    // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
    data: promise as Promise<Awaited<T>>,
  });
}

/**
 * Runs an asynchronous computation that has no uninterpreted effects other than `async`.
 * @param comp The computation to run.
 * @returns A promise that resolves to the value returned by the computation.
 */
// eslint-disable-next-line @typescript-eslint/promise-function-async
export function runAsync<T>(comp: Eff<T, "async">): Promise<Awaited<T>> {
  return run(
    comp,
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    (value) => Promise.resolve(value),
    // eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/prefer-promise-reject-errors
    (error) => Promise.reject(error),
    {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      async(effect, resume, abort) {
        return effect.data.then(resume, abort);
      },
    },
  );
}
