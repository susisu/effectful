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

// 1. Augment `EffectDef<A>` to define effects

declare module "@susisu/effectful" {
  interface EffectDef<A> {
    // read environment variables
    env: {
      name: string;
      // constrains A = string | undefined
      c: (x: string | undefined) => A;
    };
    // log messages
    log: {
      message: string;
      // constrains A = void
      c: (x: void) => A;
    };
    // throw exceptions
    exn: {
      error: Error;
    };
  }
}

// 2. Define atomic computations using `perform`

function env(name: string): Eff<"env", string | undefined> {
  return perform({
    // property name in EffectDef
    id: "env",
    // property type in EffectDef
    data: { name, c: (x) => x },
  });
}

function log(message: string): Eff<"log", void> {
  return perform({
    id: "log",
    data: { message, c: (x) => x },
  });
}

function exn(error: Error): Eff<"exn", never> {
  return perform({
    id: "exn",
    data: { error },
  });
}

// 3. Write computations using generators

function* getNumber(name: string): Eff<"env" | "exn", number> {
  const value = yield* env(name);
  if (value === undefined) {
    yield* exn(new Error(`${name} is not defined`));
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    yield* exn(new Error(`${name} is not a number`));
  }
  return number;
}

function* main(): Eff<"env" | "log" | "exn", void> {
  const a = yield* getNumber("NUMBER_A");
  const b = yield* getNumber("NUMBER_B");
  const message = `${a} + ${b} = ${a + b}`;
  yield* log(message);
}

// 4. Write effect handlers

// in app
function runApp<A>(comp: Eff<"env" | "log" | "exn", A>): A {
  return run(
    comp,
    // return handler
    (x) => x,
    // effect handlers
    {
      env: (eff, resume) => {
        const value = process.env[eff.data.name] ?? undefined;
        return resume(eff.data.c(value));
      },
      log: (eff, resume) => {
        console.log(eff.data.message);
        return resume(eff.data.c(undefined));
      },
      exn: (eff) => {
        throw eff.data.error;
      },
    },
  );
}

// in test
function runTest<A>(
  comp: Eff<"env" | "log" | "exn", A>,
  env: ReadonlyMap<string, string>,
  log: (message: string) => void,
): A {
  return run(
    comp,
    // return handler
    (x) => x,
    // effect handlers
    {
      env: (eff, resume) => {
        const value = env.get(eff.data.name);
        return resume(eff.data.c(value));
      },
      log: (eff, resume) => {
        log(eff.data.message);
        return resume(eff.data.c(undefined));
      },
      exn: (eff) => {
        throw eff.data.error;
      },
    },
  );
}

// 5. Run the computation

// in app
runApp(main());

// in test
describe("main", () => {
  it("works", () => {
    const env = new Map([
      ["NUMBER_A", "2"],
      ["NUMBER_B", "3"],
    ]);
    const log = vi.fn(() => {});
    runTest(main(), env, log);
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
