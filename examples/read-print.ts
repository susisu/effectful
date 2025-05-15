// ### 1. Register effects

// You can register effects by extending `EffectRegistry<T>`.

declare module "../src/index.js" {
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

// ### 2. Define smart constructors for effects

// This is for later convenience.
// Here "smart constructors" are functions that construct atomic computations.
// `Eff<T, Row>` is the type of compuations that perform effects in `Row` (a union type of effect keys) and return `T`.

import type { Eff } from "../src/index.js";
import { perform } from "../src/index.js";

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

// Write interpreters to translate effects to real-world ones.

import type { Interpreter } from "../src/index.js";
import { waitFor } from "../src/index.js";
import { readFile } from "fs/promises";

// Translates `read` effect to `async` effect.
// eslint-disable-next-line func-style
const interpretRead: Interpreter<"read", "async"> = function* (effect) {
  const content = yield* waitFor(readFile(effect.data.filename, "utf-8"));
  // Here the type `effect` is `Effect<"read", S>`, so the return value must be of type `S`.
  // You can use `constraint: (x: string) => S` to convert `content: string` to `S`.
  return effect.data.constraint(content);
};

// Interprets `print` effect as output to the console.
// eslint-disable-next-line func-style
const interpretPrint: Interpreter<"print", never> = function* (effect) {
  // eslint-disable-next-line no-console
  console.log(effect.data.message);
  return effect.data.constraint(undefined);
};

// ### 5. Run computations

// Run our `main` computation with interpreters.

import { interpret, runAsync } from "../src/index.js";

runAsync(
  interpret<"read" | "print", "async", void>(main(), {
    read: interpretRead,
    print: interpretPrint,
  }),
).catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
