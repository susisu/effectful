/**
 * `EffectRegistry<T>` defines the set of effects.
 * Users can extend this interface to define custom effects.
 *
 * Each property defines an effect; the property name is the ID of the effect, and the property type
 * is the associated data type of the effect.
 * @param T Placeholder for the type that is returned when an effect is performed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EffectRegistry<T> {}

/**
 * `EffectId` is the union of all possible effect IDs.
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
 * `Effectful<Row, T>` represents an effectful computation that may perform effects in `Row` and
 * returns `T`.
 */
export type Effectful<Row extends EffectId, T> = Generator<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Effect<Row, any>,
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

/**
 * `Eff<Row, T>` is an alias for `Effectful<Row, T>`.
 */
export type Eff<Row extends EffectId, T> = Effectful<Row, T>;

/**
 * Creates an effectful computation that performs a single effect.
 * @param eff The effect to perform.
 * @returns An effectful computation.
 */
export function* perform<Row extends EffectId, T>(eff: Effect<Row, T>): Effectful<Row, T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return yield eff;
}

/**
 * Maps the return value of the computation.
 * @param comp A computation.
 * @param func A function that maps the return value of the computation.
 * @returns A computation that returns the value mapped by `func`.
 */
export function* map<Row extends EffectId, T, U>(
  comp: Effectful<Row, T>,
  func: (value: T) => U,
): Effectful<Row, U> {
  const value = yield* comp;
  return func(value);
}

/**
 * Creates a computation that does not perform any effect and returns the given value.
 * @param value The value that the compuation returns.
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
 * `Handler<Row, U>` handles effects in `Row` and returns a value of type `U`.
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
 * Runs an effectful computation.
 * @param comp The effectful computation to run.
 * It can `yield*` to compose other effectful computations.
 * @param ret A function that handles the return value of the computation.
 * @param handlers Effect handlers that handle effects performed in the computation.
 * An effect handler can resolve an effect and resume the computation, or abort the whole computation.
 * @returns A value returned from `ret` or `handlers`.
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
 * Handles a subset of effects performed by a computation.
 * @param comp The effectful computation.
 * @param ret A function that handles the return value of the computation.
 * @param handlers Effect handlers that handle effects performed in the computation.
 * @returns The same computation that only performs the rest subset of the effects.
 */
export function handle<Row extends EffectId, SubRow extends Row, T, U>(
  comp: Effectful<Row, T>,
  ret: (value: T) => Effectful<Exclude<Row, SubRow>, U>,
  handlers: Handlers<SubRow, Effectful<Exclude<Row, SubRow>, U>>,
): Effectful<Exclude<Row, SubRow>, U> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loop = (value?: any): Effectful<Exclude<Row, SubRow>, U> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const res = comp.next(value);
    if (res.done) {
      return ret(res.value);
    } else {
      let resumed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resume = (value: any): Effectful<Exclude<Row, SubRow>, U> => {
        if (resumed) {
          throw new Error("resume cannot be called more than once");
        }
        resumed = true;
        return loop(value);
      };

      const eff = res.value;
      // `eff.id in handlers` does not always imply `eff.id: SubRow` because of subtyping, but we assume so.
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
  return loop();
}
