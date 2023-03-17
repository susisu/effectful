# @susisu/effectful

[![CI](https://github.com/susisu/effectful/workflows/CI/badge.svg)](https://github.com/susisu/effectful/actions?query=workflow%3ACI)

``` shell
npm i @susisu/effectful
# or
yarn add @susisu/effectful
```

## Example

``` ts
import { Effectful, makeEffect, run } from "@susisu/effectful";

// 1. Augment `EffectDef<A>` to define new kinds of effects

declare module "@susisu/effectful" {
  interface EffectDef<A> {
    "state/get": {
      k: (x: number) => A; // constrains A = number
    };
    "state/put": {
      value: number;
      k: (x: undefined) => A; // constrains A = undefined
    };
  }
}

// 2. Define effect constructors using `makeEffect`

const getState = makeEffect<"state/get", number>("state/get", {
  k: x => x,
});

const putState = (value: number) =>
  makeEffect<"state/put", undefined>("state/put", {
    value,
    k: x => x,
  });

// 3. Write effect handlers

function runState<T>(
  comp: Effectful<"state/get" | "state/put", T>,
  state: { current: number }
): T {
  return run(comp, x => x, {
    "state/get": (eff, resume) => {
      return resume(eff.value.k(state.current));
    },
    "state/put": (eff, resume) => {
      state.current = eff.value.value;
      return resume(eff.value.k(undefined));
    },
  });
}

// 4. Write computations using generators

function* getAndMultiplyState(
  multiplier: number
): Effectful<"state/get", number> {
  // use `yield*` to perform an effect
  const value = yield* getState;
  return multiplier * value;
}

function* main(): Effectful<"state/get" | "state/put", string> {
  // computations can be nested
  const newValue = yield* getAndMultiplyState(3);
  yield* putState(newValue);
  return `current state is ${newValue}`;
}

// 5. Run the computation

const state = { current: 2 };
const result = runState(main(), state);
console.log(result);
// => "current state is 6"
console.log(state);
// => { current: 6 }
```

## License

[MIT License](http://opensource.org/licenses/mit-license.php)

## Author

Susisu ([GitHub](https://github.com/susisu), [Twitter](https://twitter.com/susisu2413))

## Prior works

- [briancavalier/fx-ts](https://github.com/briancavalier/fx-ts/)
- [susisu/effects](https://github.com/susisu/effects)
