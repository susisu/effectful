import type { Eff, Interpreter } from "../src/index.js";
import { interpret, perform, runAsync, runPure, waitFor } from "../src/index.js";
import * as fs from "node:fs/promises";

declare module "../src/index.js" {
  interface EffectRegistry<T> {
    net: {
      type: "httpGet";
      url: URL;
      c: (x: string) => T;
    };
    fs: {
      type: "writeFile";
      filename: string;
      data: string;
      c: (x: void) => T;
    };
  }
}

function httpGet(url: string | URL): Eff<string, "net"> {
  return perform({
    key: "net",
    data: {
      type: "httpGet",
      url: new URL(url),
      c: (x) => x,
    },
  });
}

function writeFile(filename: string, data: string): Eff<void, "fs"> {
  return perform({
    key: "fs",
    data: {
      type: "writeFile",
      filename,
      data,
      c: (x) => x,
    },
  });
}

function* main(): Eff<void, "net" | "fs"> {
  const icon = yield* httpGet("https://susisu.ch/icon.svg");
  yield* writeFile("./icon.svg", icon);
}

// eslint-disable-next-line func-style
const interpretNet: Interpreter<"net", "async"> = function* (effect) {
  switch (effect.data.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "httpGet": {
      const res = yield* waitFor(fetch(effect.data.url));
      const data = yield* waitFor(res.text());
      return effect.data.c(data);
    }
    default:
      throw new Error(effect.data.type satisfies never);
  }
};

// eslint-disable-next-line func-style
const interpretFs: Interpreter<"fs", "async"> = function* (effect) {
  switch (effect.data.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "writeFile": {
      yield* waitFor(fs.writeFile(effect.data.filename, effect.data.data, "utf-8"));
      return effect.data.c(undefined);
    }
    default:
      throw new Error(effect.data.type satisfies never);
  }
};

runAsync(
  interpret(main(), {
    net: interpretNet,
    fs: interpretFs,
  }),
).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
});

// eslint-disable-next-line func-style
const mockNet: Interpreter<"net", never> = function* (effect) {
  switch (effect.data.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "httpGet": {
      // eslint-disable-next-line no-console
      console.log(`HTTP GET: ${effect.data.url.toString()}`);
      return effect.data.c("DUMMY");
    }
    default:
      throw new Error(effect.data.type satisfies never);
  }
};

// eslint-disable-next-line func-style
const mockFs: Interpreter<"fs", never> = function* (effect) {
  switch (effect.data.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "writeFile": {
      // eslint-disable-next-line no-console
      console.log(`Write file: ${effect.data.filename}\n${effect.data.data}`);
      return effect.data.c(undefined);
    }
    default:
      throw new Error(effect.data.type satisfies never);
  }
};

runPure(
  interpret(main(), {
    net: mockNet,
    fs: mockFs,
  }),
);
