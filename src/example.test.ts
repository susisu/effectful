// Tests the example code on README

import { describe, it, expect } from "vitest";
import type { Eff } from ".";
import { perform, run } from ".";

// 1. Augment `EffectDef<A>` to define effects

declare module "." {
  interface EffectDef<A> {
    "state/get": {
      // constrains A = number and converts number to A
      c: (x: number) => A;
    };
    "state/put": {
      value: number;
      // constrains A = undefined and converts undefined to A
      c: (x: undefined) => A;
    };
  }
}

// 2. Define atomic computations using `perform`

const getState: Eff<"state/get", number> = perform({
  // property name in EffectDef
  id: "state/get",
  // property type in EffectDef
  data: {
    c: (x) => x,
  },
});

const putState = (value: number): Eff<"state/put", undefined> => {
  return perform({
    id: "state/put",
    data: {
      value,
      c: (x) => x,
    },
  });
};

// 3. Write effect handlers

function runState<T>(
  // stateful computation
  comp: Eff<"state/get" | "state/put", T>,
  // state to be manipulated
  state: { current: number },
): T {
  return run(
    comp,
    // return handler
    (x) => x,
    // effect handlers
    {
      "state/get": (eff, resume) => {
        return resume(eff.data.c(state.current));
      },
      "state/put": (eff, resume) => {
        state.current = eff.data.value;
        return resume(eff.data.c(undefined));
      },
    },
  );
}

// 4. Write computations using generators

function* getAndMultiplyState(multiplier: number): Eff<"state/get", number> {
  // use `yield*` to compose computations
  const value = yield* getState;
  return multiplier * value;
}

function* main(): Eff<"state/get" | "state/put", string> {
  const newValue = yield* getAndMultiplyState(3);
  yield* putState(newValue);
  return `current state is ${newValue}`;
}

// 5. Run the computation

describe("example", () => {
  it("runs a stateful computation", () => {
    const state = { current: 2 };
    const result = runState(main(), state);
    expect(result).toBe("current state is 6");
    expect(state).toEqual({ current: 6 });
  });
});
