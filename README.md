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
// 1. Register effects by extending `EffectRegistry<T>`.

declare module "@susisu/effectful" {
  interface EffectRegistry<T> {
    // Reads a file and returns its content as a string.
    read: {
      filename: string;
      constraint: (x: string) => T; // constrains `T = string`
    };
    // Prints a message and returns void.
    print: {
      message: string;
      constraint: (x: void) => T; // constrains `T = void`
    };
  }
}

// 2. Define effect constructors (more accurately, atomic computations) for convenience.
// `Eff<T, Row>` is the type of compuations that perform effects in `Row` and return `T`.

import type { Eff } from "@susisu/effectful";
import { perform } from "@susisu/effectful";

function read(filename: string): Eff<string, "read"> {
  return perform({
    key: "read",
    data: {
      filename,
      constraint: (x) => x, // `constraint` should be an identity function
    },
  });
}

function print(message: string): Eff<void, "print"> {
  return perform({
    key: "print",
    data: {
      message,
      constraint: (x) => x,
    },
  });
}

// 3. Write effectful computations using generators.

function* getSize(filename: string): Eff<number, "read"> {
  // Use `yield*` to perform effects.
  const contents = yield* read(filename);
  return contents.length;
}

function* main(): Eff<void, "read" | "print"> {
  // `yield*` can also be used to compose computations.
  const size = yield* getSize("./examples/input.txt");
  yield* print(`The file contains ${size} characters.`);
}

// 4. Write interpreters.

import type { EffectKey } from "@susisu/effectful";
import { interpret, waitFor } from "@susisu/effectful";
import { readFile } from "fs/promises";

// Translates `read` effect to `async` effect.
function interpretRead<Row extends EffectKey, T>(
  comp: Eff<T, Row | "read">,
): Eff<T, Row | "async"> {
  return interpret<"read", Row | "async", T>(comp, {
    *read(effect, resume) {
      const contents = yield* waitFor(readFile(effect.data.filename, "utf-8"));
      // Use `constraint` to pass `contents` (which is a string) to `resume` (which takes `T`).
      return yield* resume(effect.data.constraint(contents));
    },
  });
}

// Interprets `print` effect as output to the console.
function interpretPrint<Row extends EffectKey, T>(comp: Eff<T, Row | "print">): Eff<T, Row> {
  return interpret<"print", Row, T>(comp, {
    *print(effect, resume) {
      // eslint-disable-next-line no-console
      console.log(effect.data.message);
      return yield* resume(effect.data.constraint(undefined));
    },
  });
}

// 5. Run computations.

import { runAsync } from "@susisu/effectful";

runAsync(interpretPrint(interpretRead(main()))).catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.log(error);
});
```

## License

[MIT License](http://opensource.org/licenses/mit-license.php)

## Author

Susisu ([GitHub](https://github.com/susisu), [Twitter](https://twitter.com/susisu2413))
