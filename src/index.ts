/**
 * `EffectDef<A>` defines the set of effects.
 * Users can extend this interface to define custom effects.
 *
 * Each property defines an effect; the property name is the ID of the effect, and the property type
 * is the associated data type of the effect.
 * @param A Placeholder for the type that is returned when an effect is performed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EffectDef<A> {}

/**
 * `EffectId` is the union of all possible effect IDs.
 */
export type EffectId = keyof EffectDef<unknown>;

/**
 * `EffectData<Row, A>` represents the data types associated to the effects in `Row`
 */
export type EffectData<Row extends EffectId, A> = EffectDef<A>[Row];

/**
 * `Effect<Row, A>` represents an effect that returns `A` when performed.
 * It distributes over `Row` i.e. `Effect<X | Y, A> = Effect<X, A> | Effect<Y, A>`
 */
export type Effect<Row extends EffectId, A> =
  Row extends infer Id extends EffectId ?
    Readonly<{
      id: Row;
      data: EffectData<Id, A>;
    }>
  : never;

/**
 * `Effectful<Row, A>` represents an effectful computation that may perform effects in `Row` and
 * returns `A`.
 */
export type Effectful<Row extends EffectId, A> = Generator<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Effect<Row, any>,
  A,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

/**
 * `Eff<Row, A>` is an alias for `Effectful<Row, A>`.
 */
export type Eff<Row extends EffectId, A> = Effectful<Row, A>;

/**
 * Creates an effectful computation that performs a single effect.
 * @param eff The effect to perform.
 * @returns An effectful computation.
 */
export function* perform<Row extends EffectId, A>(eff: Effect<Row, A>): Effectful<Row, A> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return yield eff;
}

/**
 * `Handler<Row, R>` handles effects in `Row` and returns a value of type `R`.
 * It distributes over `Row` i.e. `Handler<X | Y, A> = Handler<X, A> | Handler<Y, A>`
 */
export type Handler<Row extends EffectId, R> =
  Row extends infer Id extends EffectId ? <A>(eff: Effect<Id, A>, resume: (value: A) => R) => R
  : never;

/**
 * `Handlers<Row, R>` is a set of effect handlers.
 */
export type Handlers<Row extends EffectId, R> = Readonly<{
  [Id in Row]: Handler<Id, R>;
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
export function run<Row extends EffectId, A, R>(
  comp: Effectful<Row, A>,
  ret: (value: A) => R,
  handlers: Handlers<Row, R>,
): R {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loop = (value?: any): R => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const res = comp.next(value);
    if (res.done) {
      return ret(res.value);
    } else {
      let resumed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resume = (value: any): R => {
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
 * Creates a computation that does not perform any effect and returns the given value.
 * @param value The value that the compuation returns.
 * @returns A new computation.
 */
// eslint-disable-next-line require-yield
export function* pure<Row extends EffectId, A>(value: A): Effectful<Row, A> {
  return value;
}

/**
 * Composes two computations sequentially.
 * @param comp A computation.
 * @param func A function that takes the return value of the first computation and returns a
 * subsequent computation.
 * @returns A composed computation.
 */
export function* bind<Row extends EffectId, A, B>(
  comp: Effectful<Row, A>,
  func: (value: A) => Effectful<Row, B>,
): Effectful<Row, B> {
  const value = yield* comp;
  return yield* func(value);
}

/**
 * Handles a subset of effects performed by a computation.
 * @param comp The effectful computation.
 * @param ret A function that handles the return value of the computation.
 * @param handlers Effect handlers that handle effects performed in the computation.
 * @returns The same computation that only performs the rest subset of the effects.
 */
export function handle<Row extends EffectId, SubRow extends Row, A, R>(
  comp: Effectful<Row, A>,
  ret: (value: A) => Effectful<Exclude<Row, SubRow>, R>,
  handlers: Handlers<SubRow, Effectful<Exclude<Row, SubRow>, R>>,
): Effectful<Exclude<Row, SubRow>, R> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loop = (value?: any): Effectful<Exclude<Row, SubRow>, R> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const res = comp.next(value);
    if (res.done) {
      return ret(res.value);
    } else {
      let resumed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resume = (value: any): Effectful<Exclude<Row, SubRow>, R> => {
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
