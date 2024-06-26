# @susisu/effectful

[![CI](https://github.com/susisu/effectful/actions/workflows/ci.yml/badge.svg)](https://github.com/susisu/effectful/actions/workflows/ci.yml)

``` shell
# npm
npm i @susisu/effectful
# yarn
yarn add @susisu/effectful
# pnpm
pnpm add @susisu/effectful
```

## Example

``` ts
import type { Eff } from "@susisu/effectful";
import { perform, run } from "@susisu/effectful";

// 1. Declare effects by augmenting `EffectDef<A>` interface.

declare module "@susisu/effectful" {
  interface EffectDef<A> {
    // read environment variables
    env: {
      name: string;
      // NOTE: `ev` is short for `evidence`, and it effectively constrains A = string | undefined
      ev: (x: string | undefined) => A;
    };
    // log messages
    log: {
      message: string;
      ev: (x: void) => A;
    };
    // throw exceptions
    exn: {
      error: Error;
    };
    // run async operations
    async: {
      promise: Promise<A>;
    };
  }
}

// 2. For convenience, define atomic computations each `perform`s a single effect.
// `Eff<Row, T>` is the type of computations which performs effects declared in `Row` and returns `T`.

function env(name: string): Eff<"env", string | undefined> {
  return perform({
    // property name in `EffectDef<A>`
    id: "env",
    // property type in `EffectDef<A>`
    data: {
      name,
      // NOTE: `ev` should be an identity function
      ev: (x) => x,
    },
  });
}

function log(message: string): Eff<"log", void> {
  return perform({
    id: "log",
    data: {
      message,
      ev: (x) => x,
    },
  });
}

function exn(error: Error): Eff<"exn", never> {
  return perform({
    id: "exn",
    data: {
      error,
    },
  });
}

function async<A>(promise: Promise<A>): Eff<"async", A> {
  return perform({
    id: "async",
    data: {
      promise,
    },
  });
}

// 3. Write computations using generators.

function* getNumber(name: string): Eff<"env" | "exn", number> {
  // use `yield*` to perform effects
  // NOTE: str is typed as `string | undefined`
  const str = yield* env(name);
  if (str === undefined) {
    yield* exn(new Error(`environment variable "${name}" is not defined`));
  }
  const num = Number(str);
  if (Number.isNaN(num)) {
    yield* exn(new Error(`environment variable "${name}" is not a number`));
  }
  return num;
}

function* delay(millis: number): Eff<"async", void> {
  yield* async(
    new Promise((resolve) => {
      setTimeout(resolve, millis);
    }),
  );
}

function* main(): Eff<"env" | "log" | "exn" | "async", void> {
  // `yield*` can also be used to compose computations
  const a = yield* getNumber("NUMBER_A");
  const b = yield* getNumber("NUMBER_B");
  yield* delay(1000);
  const message = `${a} + ${b} = ${a + b}`;
  yield* log(message);
}

// 4. Write effect handlers.

// in app
function runApp<A>(comp: Eff<"env" | "log" | "exn" | "async", A>): Promise<A | undefined> {
  return run<"env" | "log" | "exn" | "async", A, Promise<A | undefined>>(
    comp,
    // return handler
    (x) => Promise.resolve(x),
    // effect handlers
    {
      env: (eff, resume) => {
        const value = process.env[eff.data.name] ?? undefined;
        return resume(eff.data.ev(value));
      },
      log: (eff, resume) => {
        console.log(eff.data.message);
        return resume(eff.data.ev(undefined));
      },
      exn: (eff) => {
        console.error(eff.data.error);
        return Promise.resolve(undefined);
      },
      async: (eff, resume) => {
        return eff.data.promise.then(resume);
      },
    },
  );
}

// in test
function runTest<A>(
  comp: Eff<"env" | "log" | "exn" | "async", A>,
  env: ReadonlyMap<string, string>,
  log: (message: string) => void,
): Promise<A> {
  return run(comp, (x) => Promise.resolve(x), {
    env: (eff, resume) => {
      const value = env.get(eff.data.name);
      return resume(eff.data.ev(value));
    },
    log: (eff, resume) => {
      log(eff.data.message);
      return resume(eff.data.ev(undefined));
    },
    exn: (eff) => {
      return Promise.reject(eff.data.error);
    },
    async: (eff, resume) => {
      return eff.data.promise.then(resume);
    },
  });
}

// 5. Run computations.

// in app
runApp(main());

// in test
import { vi, describe, it, expect } from "vitest";

describe("main", () => {
  it("works", async () => {
    const env = new Map([
      ["NUMBER_A", "2"],
      ["NUMBER_B", "3"],
    ]);
    const log = vi.fn(() => {});
    await runTest(main(), env, log);
    expect(log).toHaveBeenCalledWith("2 + 3 = 5");
  });
});
```

## License

[MIT License](http://opensource.org/licenses/mit-license.php)

## Author

Susisu ([GitHub](https://github.com/susisu), [Twitter](https://twitter.com/susisu2413))

## Prior art

- [briancavalier/fx-ts](https://github.com/briancavalier/fx-ts/)
- [susisu/effects](https://github.com/susisu/effects)
