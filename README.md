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
// 1. Register effects by augmenting `EffectRegistry<T>`.

declare module "@susisu/effectful" {
  interface EffectRegistry<T> {
    // Reads contents of a file
    read: {
      filename: string;
      // `ev` is short for "evidence" and it constrains `T` = `string`
      ev: (x: string) => T;
    };
    // Prints a message
    print: {
      message: string;
      ev: (x: void) => T;
    };
    // Waits for a promise
    async: {
      promise: Promise<T>;
    };
  }
}

// 2. Define effect constructors (more accurately, atomic computations) for convenience.
// `Eff<Row, T>` is the type of a compuation that performs effects in `Row` and returns `T`.

import type { Eff } from "@susisu/effectful";
import { perform } from "@susisu/effectful";

function read(filename: string): Eff<"read", string> {
  return perform({
    // Property name in `EffectRegistry<T>`
    id: "read",
    // Property type in `EffectRegistry<T>`
    data: {
      filename,
      // `ev` should be an identity function
      ev: (x) => x,
    },
  });
}

function print(message: string): Eff<"print", void> {
  return perform({
    id: "print",
    data: {
      message,
      ev: (x) => x,
    },
  });
}

function async<T>(promise: Promise<T>): Eff<"async", T> {
  return perform({
    id: "async",
    data: {
      promise,
    },
  });
}

// 3. Write complex computations using generators.

function* getSize(filename: string): Eff<"read", number> {
  // Use `yield*` to perform effects
  const contents = yield* read(filename);
  return contents.length;
}

function* main(): Eff<"read" | "print", void> {
  // `yield*` can also be used to compose computations
  const size = yield* getSize("./input.txt");
  yield* print(`The file contains ${size} characters!`);
}

// 4. Write interpreters.

import type { EffectId } from "@susisu/effectful";
import { interpose, run } from "@susisu/effectful";
import { readFile } from "fs/promises";

function interpretRead<Row extends EffectId, T>(comp: Eff<Row | "read", T>): Eff<Row | "async", T> {
  return interpose<"read", Row | "async", T>(comp, {
    *read(eff, resume) {
      const contents = yield* async(readFile(eff.data.filename, "utf-8"));
      return yield* resume(eff.data.ev(contents));
    },
  });
}

function interpretPrint<Row extends EffectId, T>(comp: Eff<Row | "print", T>): Eff<Row, T> {
  return interpose<"print", Row, T>(comp, {
    *print(eff, resume) {
      console.log(eff.data.message);
      return yield* resume(eff.data.ev(undefined));
    },
  });
}

function runAsync<T>(comp: Eff<"async", T>): Promise<T> {
  return run(comp, (x) => Promise.resolve(x), {
    async(eff, resume) {
      return eff.data.promise.then(resume);
    },
  });
}

// 5. Run computations.

runAsync(interpretPrint(interpretRead(main()))).catch((err) => {
  console.error(err);
});
```

## License

[MIT License](http://opensource.org/licenses/mit-license.php)

## Author

Susisu ([GitHub](https://github.com/susisu), [Twitter](https://twitter.com/susisu2413))

## Prior art

- [briancavalier/fx-ts](https://github.com/briancavalier/fx-ts/)
- [susisu/effects](https://github.com/susisu/effects)
