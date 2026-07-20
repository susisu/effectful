// ### 1. Register effects

// You can register effects by extending `EffectRegistry<T>`.

declare module "../src/index.js" {
  interface EffectRegistry<T> {
    // Reads a file and returns its content as a string.
    read: {
      filename: string;
      $ev: (x: string) => T; // evidence that `T = string`
    };
    // Prints a message and returns void.
    print: {
      message: string;
      $ev: (x: void) => T; // evidence that `T = void`
    };
  }
}

// ### 2. Define smart constructors for effects

// This is for later convenience.
// Here "smart constructors" are functions that construct atomic computations.
// `Eff<T, Row>` is the type of computations that return `T` and may perform effects in `Row` (a union of effect keys).

import type { Eff } from "../src/index.js";
import { perform } from "../src/index.js";

function read(filename: string): Eff<string, "read"> {
  return perform({
    key: "read",
    data: {
      filename,
      $ev: (x) => x, // `$ev` should be an identity function
    },
  });
}

function print(message: string): Eff<void, "print"> {
  return perform({
    key: "print",
    data: {
      message,
      $ev: (x) => x,
    },
  });
}

// ### 3. Write effectful computations

// You can write effectful computations using generators, like async / await for Promises.

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

// ### 4. Write interpreters

// Write interpreters to translate effects into real-world ones.

import type { Interpreter } from "../src/index.js";
import { waitFor } from "../src/index.js";
import { readFile } from "fs/promises";

// Translates the `read` effect into the `async` effect.
// eslint-disable-next-line func-style
const interpretRead: Interpreter<"read", "async"> = function* (effect) {
  const content = yield* waitFor(readFile(effect.data.filename, "utf-8"));
  // Use `$ev` to convert the actual result into the expected type.
  return effect.data.$ev(content);
};

// Interprets the `print` effect as output to the console.
// eslint-disable-next-line func-style
const interpretPrint: Interpreter<"print", never> = function* (effect) {
  // eslint-disable-next-line no-console
  console.log(effect.data.message);
  return effect.data.$ev(undefined);
};

// ### 5. Run computations

// Run our `main` computation with the interpreters.

import { interpret, runAsync } from "../src/index.js";

runAsync(
  interpret(main(), {
    read: interpretRead,
    print: interpretPrint,
  }),
).catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
