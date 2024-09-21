/**
 * `EffectRegistry<T>` is the global registry for effects.
 * Users can extend this interface to register custom effects.
 *
 * Each property registers an effect; the property name is the ID of the effect, and the property
 * type is the associated data type of the effect.
 * @param T The type that is returned when an effect is performed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EffectRegistry<out T> {}

/**
 * `EffectId` is the union of all the possible effect IDs.
 */
export type EffectId = keyof EffectRegistry<unknown>;

/**
 * `EffectData<Row, T>` represents the data types associated to the effects in `Row`
 */
export type EffectData<Row extends EffectId, T> = EffectRegistry<T>[Row];

/**
 * `Effect<Row, T>` represents an effect that returns `T` when performed.
 * It distributes over `Row` i.e. `Effect<X | Y, T> = Effect<X, T> | Effect<Y, T>`
 */
export type Effect<Row extends EffectId, T> =
  Row extends infer Id extends EffectId ?
    Readonly<{
      id: Row;
      data: EffectData<Id, T>;
    }>
  : never;

/**
 * `Effectful<Row, T>` represents an effectful computation that performs effects in `Row` and
 * returns `T`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Effectful<Row extends EffectId, T> = Generator<Effect<Row, any>, T, any>;

/**
 * `Eff<Row, T>` is an alias for `Effectful<Row, T>`.
 */
export type Eff<Row extends EffectId, T> = Effectful<Row, T>;

/**
 * Creates an computation that performs a single effect.
 * @param eff An effect to perform.
 * @returns A new computation.
 */
export function* perform<Row extends EffectId, T>(eff: Effect<Row, T>): Effectful<Row, T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return yield eff;
}

/**
 * Transforms the return value of a computation by a function.
 * @param comp A computation.
 * @param func A function that transforms the return value of the computation.
 * @returns A computation that returns the value transformed by the function.
 */
export function* map<Row extends EffectId, T, U>(
  comp: Effectful<Row, T>,
  func: (value: T) => U,
): Effectful<Row, U> {
  const value = yield* comp;
  return func(value);
}

/**
 * Creates a computation that does not perform any effects.
 * @param value A value that is returned by the compuation.
 * @returns A new computation.
 */
// eslint-disable-next-line require-yield
export function* pure<Row extends EffectId, T>(value: T): Effectful<Row, T> {
  return value;
}

/**
 * Composes two computations sequentially.
 * @param comp A computation.
 * @param func A function that takes the return value of the first computation and returns a
 * subsequent computation.
 * @returns A composed computation.
 */
export function* bind<Row extends EffectId, T, U>(
  comp: Effectful<Row, T>,
  func: (value: T) => Effectful<Row, U>,
): Effectful<Row, U> {
  const value = yield* comp;
  return yield* func(value);
}

/**
 * `Handler<Row, U>` handles (or interprets) effects in `Row` and returns a value of type `U`.
 * It distributes over `Row` i.e. `Handler<X | Y, U> = Handler<X, U> | Handler<Y, U>`
 */
export type Handler<Row extends EffectId, U> =
  Row extends infer Id extends EffectId ? <T>(eff: Effect<Id, T>, resume: (value: T) => U) => U
  : never;

/**
 * `Handlers<Row, T>` is a set of effect handlers.
 */
export type Handlers<Row extends EffectId, U> = Readonly<{
  [Id in Row]: Handler<Id, U>;
}>;

/**
 * Runs an effectful computation by interpreting effects by handlers.
 * @param comp A computation to run.
 * @param ret A function that handles the return value of the computation.
 * @param handlers A set of effect handlers that handles effects performed in the computation.
 * @returns A value returned by `ret` if the computation has completed, or by `handlers` if it has
 * been aborted.
 */
export function run<Row extends EffectId, T, U>(
  comp: Effectful<Row, T>,
  ret: (value: T) => U,
  handlers: Handlers<Row, U>,
): U {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loop = (value?: any): U => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const res = comp.next(value);
    if (res.done) {
      return ret(res.value);
    } else {
      let resumed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resume = (value: any): U => {
        if (resumed) {
          throw new Error("resume cannot be called more than once");
        }
        resumed = true;
        return loop(value);
      };
      const eff = res.value;
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
      const handler = handlers[eff.id as Row];
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
      return handler(eff as never, resume);
    }
  };
  return loop();
}

/**
 * Re-interprets a subset of the effects performed by a computation.
 * @param comp A computation.
 * @param handlers A set of effect handlers that handles effects performed in the computation.
 * @returns A modified computation.
 */
export function* interpose<Row extends EffectId, SubRow extends Row, T>(
  comp: Effectful<Row, T>,
  handlers: Handlers<SubRow, Effectful<Exclude<Row, SubRow>, T>>,
): Effectful<Exclude<Row, SubRow>, T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loop = (value?: any): Effectful<Exclude<Row, SubRow>, T> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const res = comp.next(value);
    if (res.done) {
      return pure(res.value);
    } else {
      let resumed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resume = (value: any): Effectful<Exclude<Row, SubRow>, T> => {
        if (resumed) {
          throw new Error("resume cannot be called more than once");
        }
        resumed = true;
        return loop(value);
      };
      const eff = res.value;
      // `eff.id in handlers` does not always imply `eff.id: SubRow` because of subtyping, but here
      // we assume so.
      // eslint-disable-next-line @susisu/safe-typescript/no-unsafe-object-property-check
      if (eff.id in handlers) {
        // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
        const handler = handlers[eff.id as SubRow];
        // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
        return handler(eff as never, resume);
      } else {
        // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
        return bind(perform(eff as Effect<Exclude<Row, SubRow>, any>), resume);
      }
    }
  };
  return yield* loop();
}
