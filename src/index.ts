import type { Single } from "./utils.js";

/**
 * `EffectDef<A>` defines the set of computational effects.
 * Each property represents a mapping from an effect kind to its associated value type.
 * It is declared as an interface, so users can extend its definition to add their own effect kinds.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EffectDef<A> {}

/**
 * `EffectKind` is a union type of all possible effect kinds.
 */
export type EffectKind = keyof EffectDef<unknown>;

/**
 * `EffectValue<K, A>` is the type of associated value of an effect of kind `K` and type `A`.
 */
export type EffectValue<K extends EffectKind, A> = EffectDef<A>[K];

/**
 * `Effect<K, A>` represents a computational effect of kind `K` and of type `A`.
 */
export type Effect<K extends EffectKind, A> = Readonly<{
  kind: Single<K>;
  value: EffectValue<K, A>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [Symbol.iterator]: () => Iterator<Effect<K, A>, A, any>;
}>;

/**
 * Make an effect object.
 * @param kind The kind of the effect.
 * @param value An associated value of the effect.
 * @returns An effect object.
 */
export function makeEffect<K extends EffectKind, A>(
  kind: Single<K>,
  value: EffectValue<K, A>,
): Effect<K, A> {
  const eff: Effect<K, A> = {
    kind,
    value,
    *[Symbol.iterator]() {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return yield eff;
    },
  };
  return eff;
}

/**
 * `Effectful<K, A>` represents an effectful computation that may perform effects of kind `K` and
 * returns a value of type `A`.
 * A computation can perform multiple kinds of effects, and in that case `K` will be a union type of
 * those effect kinds.
 */
export type Effectful<K extends EffectKind, A> = Generator<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  K extends unknown ? Effect<K, any> : never,
  A,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

/**
 * `Handler<K, R>` represents an effect handler of kind `K`.
 */
export type Handler<K extends EffectKind, R> = <A>(eff: Effect<K, A>, resume: (value: A) => R) => R;

/**
 * `Handlers<K, R>` is a set of effect handlers of kinds `K`.
 */
export type Handlers<K extends EffectKind, R> = Readonly<{ [K0 in K]: Handler<K0, R> }>;

/**
 * Run an effectful computation.
 * @param comp An effectful computation. It can yield to perform some computational effects.
 * @param ret A function that handles the return value of the computation.
 * @param handlers Effect handlers that handle effects performed in the computation.
 * An effect handler resolves an effect and resume the computation, or aborts the whole computation.
 * @returns The return value of the computation, handled by `ret` or `handlers`.
 */
export function run<K extends EffectKind, A, R>(
  comp: Effectful<K, A>,
  ret: (value: A) => R,
  handlers: Handlers<K, R>,
): R {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resume = (value?: any): R => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const res = comp.next(value);
    if (res.done) {
      return ret(res.value);
    } else {
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion, @typescript-eslint/no-explicit-any
      const eff = res.value as unknown as Effect<never, any>;
      // eslint-disable-next-line @susisu/safe-typescript/no-type-assertion
      const handler = handlers[eff.kind] as Handler<never, R>;
      return handler(eff, resume);
    }
  };
  return resume();
}
