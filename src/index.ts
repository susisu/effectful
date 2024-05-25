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
export type Effect<Row extends EffectId, A> = {
  [Id in Row]: Readonly<{
    id: Id;
    data: EffectData<Id, A>;
  }>;
}[Row];

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
export type Handler<Row extends EffectId, R> = {
  [Id in Row]: <A>(eff: Effect<Id, A>, resume: (value: A) => R) => R;
}[Row];

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
      const eff = res.value;
      const handler = handlers[eff.id];
      let resumed = false;
      return handler(eff, (value) => {
        if (resumed) {
          throw new Error("resume cannot be called more than once");
        }
        resumed = true;
        return loop(value);
      });
    }
  };
  return loop();
}
