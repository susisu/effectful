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
      constraint: (x: string) => T; // constrains `T = string`
    };
    // Prints a message and returns void.
    print: {
      message: string;
      constraint: (x: void) => T; // constrains `T = void`
    };
  }
}
```

### 2. Define smart constructors for effects

This is for later convenience.
Here "smart constructors" are functions that construct atomic computations.
`Eff<T, Row>` is the type of compuations that perform effects in `Row` (a union type of effect keys) and return `T`.

``` ts
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


### 4. Write interpreters

Write interpreters (or effect handlers) so that effects can take actual effect.

``` ts
import type { EffectKey } from "@susisu/effectful";
import { interpret, waitFor, bind } from "@susisu/effectful";
import { readFile } from "fs/promises";

// Translates `read` effect to `async` effect.
function interpretRead<Row extends EffectKey, T>(
  comp: Eff<T, Row | "read">,
): Eff<T, Row | "async"> {
  return interpret<"read", Row | "async", T>(comp, {
    read(effect, resume, abort) {
      // `bind` is a function that works like `Promise.prototype.then`.
      return bind(
        waitFor(readFile(effect.data.filename, "utf-8")),
        // Use `constraint: (x: string) => S` to pass `contents: string` to `resume: (value: S) => ...`.
        (contents) => resume(effect.data.constraint(contents)),
        abort,
      );
    },
  });
}

// Interprets `print` effect as output to the console.
function interpretPrint<Row extends EffectKey, T>(comp: Eff<T, Row | "print">): Eff<T, Row> {
  return interpret<"print", Row, T>(comp, {
    print(effect, resume) {
      console.log(effect.data.message);
      return resume(effect.data.constraint(undefined));
    },
  });
}
```

### 5. Run computations

Run our `main` computation by interpreting the effects.

``` ts
import { runAsync } from "@susisu/effectful";

runAsync(interpretPrint(interpretRead(main())));
```

## License

[MIT License](http://opensource.org/licenses/mit-license.php)

## Author

Susisu ([GitHub](https://github.com/susisu), [Twitter](https://twitter.com/susisu2413))
