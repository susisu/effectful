/**
 * `EffectRegistry<T>` is the global registry of effects.
 * Users can extend this interface (by declaration merging) to register custom effects.
 * Each key defines an effect, and the type associated to the key is the data type of the effect.
 * @param T The type returned when an effect is performed.
 */
export interface EffectRegistry<out T> {
  async: Promise<T>;
}

/**
 * `EffectKey` is the union type containing all the keys in `EffectRegistry`,
 * i.e. the upper bound for effect rows.
 */
export type EffectKey = keyof EffectRegistry<unknown>;

/**
 * `EffectData<Key, T>` is the associated data type of effects.
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
 * `Effectful<Row, T>` is the type of effectful computations that return `T` and may perform
 * effects declared in `Row`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Effectful<Row extends EffectKey, T> = Generator<Effect<Row, any>, T, any>;

/**
 * `Eff<T, Row>` is an alias for `Effectful<Row, T>`.
 */
export type Eff<T, Row extends EffectKey = never> = Effectful<Row, T>;

/**
 * Creates a computation that performs a signle effect.
 * @param effect  An effect to perform.
 * @returns A computation that performs the given effect.
 */
export function* perform<Row extends EffectKey, T>(effect: Effect<Row, T>): Effectful<Row, T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return yield effect;
}

/**
 * Transforms the return value of a computation by a function.
 * @param comp A computation.
 * @param func A function that transforms the return value of the computation.
 * @returns A computation that returns the value transformed by the function.
 */
export function* map<Row extends EffectKey, T, U>(
  comp: Effectful<Row, T>,
  func: (value: T) => U,
): Effectful<Row, U> {
  const value = yield* comp;
  return func(value);
}

/**
 * Creates a pure computation that does not perform any effect and returns the given value.
 * @param value A value to return.
 * @returns A pure computation.
 */
// eslint-disable-next-line require-yield
export function* pure<T>(value: T): Effectful<never, T> {
  return value;
}

/**
 * Creates a computation that does not perform any effect and throws the given error.
 * @param error An error to throw.
 * @returns A computation.
 */
// eslint-disable-next-line require-yield
export function* abort(error: unknown): Effectful<never, never> {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw error;
}

/**
 * Composes (or chains) two computations sequentially, like `Promise.prototype.then`.
 * It calls `onReturn` if the first computation returns, and calls `onThrow` if throws.
 * @param comp A computation.
 * @param onReturn A function that takes the value returned by the first computation, and returns a
 * subsequent computation.
 * @param onThrow A function that takes the error thrown by the first computation, and returns a
 * subsequent computation.
 * @returns A composed computation.
 */
export function* bind<Row extends EffectKey, T, U>(
  comp: Effectful<Row, T>,
  onReturn: (value: T) => Effectful<Row, U>,
  onThrow?: (error: unknown) => Effectful<Row, U>,
): Effectful<Row, U> {
  let value;
  if (onThrow) {
    try {
      value = yield* comp;
    } catch (error) {
      return yield* onThrow(error);
    }
  } else {
    // short-circuit of onThrow = abort
    value = yield* comp;
  }
  return yield* onReturn(value);
}

/**
 * `Handler<Key, T>` is the type of effect handlers.
 * An effect handler receives effects performed in computations, and chooses whether to resume the
 * computation (with a value) or abort it (with an error).
 * It distributes over `Key`, i.e. `Handler<X | Y, T> = Handler<X, T> | Handler<Y, T>`.
 */
export type Handler<Key extends EffectKey, T> =
  Key extends unknown ?
    <S>(effect: Effect<Key, S>, resume: (value: S) => T, abort: (error: unknown) => T) => T
  : never;

/**
 * HandlerRecord<Row, T> is the type of sets of effect handlers.
 */
export type HandlerRecord<Row extends EffectKey, T> = Readonly<{
  [Key in Row]: Handler<Key, T>;
}>;

/**
 * Runs an effectful computation.
 * @param comp An effectful computation to run.
 * @param onReturn A function that handles the value returned by the computation.
 * @param onThrow A function that handles the error thrown by the computation.
 * @param handlers A set of effect handlers to handle effects performed in the computation.
 * @returns The value returned by `onReturn` or `onThrow`.
 */
export function run<Row extends EffectKey, T, U>(
  comp: Effectful<Row, T>,
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
          return onThrow(new Error("cannot resume; already resumed or aborted"));
        }
        done = true;
        return onResume(value);
      },
      (error: unknown) => {
        if (done) {
          return onThrow(new Error("cannot abort; already resumed or aborted"));
        }
        done = true;
        return onAbort(error);
      },
    );
  }

  return onResume();
}

/**
 * Interprets (or translates) a subset of effects performed in a computation.
 * @param comp An effectful computation.
 * @param handlers A set of effect handlers to interpret effects performed in the computation.
 * @returns A new computation that performs only unhandled effects.
 */
export function* interpret<RowA extends EffectKey, RowB extends EffectKey, T>(
  comp: Effectful<RowA | RowB, T>,
  handlers: HandlerRecord<RowA, Effectful<RowB, T>>,
): Effectful<RowB, T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onResume(value?: any): Effectful<RowB, T> {
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

  function onAbort(error: unknown): Effectful<RowB, T> {
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
  function onYield(effect: Effect<RowA | RowB, any>): Effectful<RowB, T> {
    // NOTE: `eff.key in handlers` does not always imply `eff.key: RowA` because of subtyping,
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
            return abort(new Error("cannot resume; already resumed or aborted"));
          }
          done = true;
          return onResume(value);
        },
        (error: unknown) => {
          if (done) {
            return abort(new Error("cannot abort; already resumed or aborted"));
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
 * Runs a pure computation.
 * @param comp A computation to run.
 * @returns The value returned by the computation.
 */
export function runPure<T>(comp: Effectful<never, T>): T {
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
 * Performs an async effect to wait for a promise.
 * @param promise A promise to wait for.
 * @returns A computation that performs an async effect.
 */
export function waitFor<T>(promise: Promise<T>): Effectful<"async", T> {
  return perform({
    key: "async",
    data: promise,
  });
}

/**
 * Runs an async computation.
 * @param comp A computation to run.
 * @returns The value returned by the computation.
 */
export function runAsync<T>(comp: Effectful<"async", T>): Promise<T> {
  return run(
    comp,
    (value) => Promise.resolve(value),
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    (error) => Promise.reject(error),
    {
      async(effect, resume, abort) {
        return effect.data.then(resume, abort);
      },
    },
  );
}
