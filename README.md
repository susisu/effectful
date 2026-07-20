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

## Examples

### 1. Register effects

You can register effects by extending `EffectRegistry<T>`.

``` ts
declare module "@susisu/effectful" {
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
```

<details>
<summary>How does <code>$ev</code> work?</summary>

The `$ev` field (short for _evidence_) serves as evidence of what type the effect returns: for example, `$ev: (x: string) => T` declares that performing the `read` effect returns a `string`, by providing a way to convert the actual result (a `string`) into the abstract type `T`. This is a technique for encoding GADTs (generalized algebraic data types) in TypeScript; see [this article](https://susisu.hatenablog.com/entry/2020/05/03/020854) (in Japanese) for more details.

</details>

### 2. Define smart constructors for effects

This is for later convenience.
Here "smart constructors" are functions that construct atomic computations.
`Eff<T, Row>` is the type of computations that return `T` and may perform effects in `Row` (a union of effect keys).

``` ts
import type { Eff } from "@susisu/effectful";
import { perform } from "@susisu/effectful";

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
```

### 3. Write effectful computations

You can write effectful computations using generators, like async / await for Promises.

``` ts
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
```

> [!NOTE]
> A computation is a generator object, and hence is stateful and single-use. Once you run a computation (or pass it to a function that consumes it, such as `interpret`), you cannot use it again.


### 4. Write interpreters

Write interpreters to translate effects into real-world ones.

The `async` effect used below is the only effect that is registered by the library out of the box. It can be performed with `waitFor`, and handled by `runAsync`.

``` ts
import type { Interpreter } from "@susisu/effectful";
import { waitFor } from "@susisu/effectful";
import { readFile } from "fs/promises";

// Translates the `read` effect into the `async` effect.
const interpretRead: Interpreter<"read", "async"> = function* (effect) {
  const content = yield* waitFor(readFile(effect.data.filename, "utf-8"));
  // Use `$ev` to convert the actual result into the expected type.
  return effect.data.$ev(content);
};

// Interprets the `print` effect as output to the console.
const interpretPrint: Interpreter<"print", never> = function* (effect) {
  console.log(effect.data.message);
  return effect.data.$ev(undefined);
};
```

### 5. Run computations

Run our `main` computation with the interpreters.

``` ts
import { interpret, runAsync } from "@susisu/effectful";

runAsync(
  interpret(main(), {
    read: interpretRead,
    print: interpretPrint,
  }),
).catch((error: unknown) => {
  console.error(error);
});

```

## License

[MIT License](http://opensource.org/licenses/mit-license.php)

## Author

Susisu ([GitHub](https://github.com/susisu), [Twitter](https://twitter.com/susisu2413))
