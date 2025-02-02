import { vi, describe, it, expect } from "vitest";
import type { Effectful } from "./index.js";
import {
  perform,
  map,
  pure,
  abort,
  bind,
  bind2,
  run,
  interpret,
  runPure,
  waitFor,
  runAsync,
} from "./index.js";

declare module "./index.js" {
  interface EffectRegistry<T> {
    "test/identity": T;
    "test/number": {
      value: number;
      constraint: (x: number) => T;
    };
    "test/string": {
      value: string;
      constraint: (x: string) => T;
    };
  }
}

function identity<T>(value: T): Effectful<"test/identity", T> {
  return perform({
    key: "test/identity",
    data: value,
  });
}

function number(value: number): Effectful<"test/number", number> {
  return perform({
    key: "test/number",
    data: {
      value,
      constraint: (x) => x,
    },
  });
}

function string(value: string): Effectful<"test/string", string> {
  return perform({
    key: "test/string",
    data: {
      value,
      constraint: (x) => x,
    },
  });
}

describe("map", () => {
  it("transforms the return value of a computation by a function", () => {
    const comp = pure(6);
    const func = (x: number): string => "A".repeat(x);
    const res = runPure(map(comp, func));
    expect(res).toBe("AAAAAA");
  });
});

describe("pure", () => {
  it("creates a pure computation that returns the given value", () => {
    const comp = pure(42);
    const res = runPure(comp);
    expect(res).toBe(42);
  });
});

describe("abort", () => {
  it("creates a computation that throws the given error", () => {
    const comp = abort(new Error("ERROR"));
    expect(() => runPure(comp)).toThrowError("ERROR");
  });
});

describe("bind", () => {
  it("composes two computations sequentially", () => {
    const comp = pure(6);
    const func = (x: number): Effectful<never, string> => pure("A".repeat(x));
    const res = runPure(bind(comp, func));
    expect(res).toBe("AAAAAA");
  });
});

describe("bind2", () => {
  it("calls `onReturn` branch if the first computation returns", () => {
    const comp = pure(6);
    const onReturn = (x: number): Effectful<never, string> => pure("A".repeat(x));
    const onThrow = (error: unknown): Effectful<never, string> => {
      if (error instanceof Error) {
        return pure(error.message);
      } else {
        return pure("");
      }
    };
    const res = runPure(bind2(comp, onReturn, onThrow));
    expect(res).toBe("AAAAAA");
  });

  it("calls `onThrow` branch if the first computation throws", () => {
    const comp = abort(new Error("ERROR"));
    const onReturn = (x: number): Effectful<never, string> => pure("A".repeat(x));
    const onThrow = (error: unknown): Effectful<never, string> => {
      if (error instanceof Error) {
        return pure(error.message);
      } else {
        return pure("");
      }
    };
    const res = runPure(bind2(comp, onReturn, onThrow));
    expect(res).toBe("ERROR");
  });
});

describe("run", () => {
  function* main(): Effectful<"test/number" | "test/string", string> {
    const x = yield* number(3);
    const y = yield* string("A");
    return y.repeat(x);
  }

  it("allows handlers to resume the computation", () => {
    const res = run(
      main(),
      (value) => value,
      (error) => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw error;
      },
      {
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value * 2));
        },
        "test/string"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value.toLowerCase()));
        },
      },
    );
    expect(res).toBe("aaaaaa");
  });

  it("allows handlers to abort the computation", () => {
    expect(() =>
      run(
        main(),
        (value) => value,
        (error) => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw error;
        },
        {
          "test/number"(effect, resume) {
            return resume(effect.data.constraint(effect.data.value));
          },
          "test/string"(_effect, _resume, abort) {
            return abort(new Error("ERROR"));
          },
        },
      ),
    ).toThrowError("ERROR");
  });

  it("allows onReturn to modify the value returned by the computation", () => {
    const res = run(
      main(),
      (value) => value.length,
      (error) => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw error;
      },
      {
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
        "test/string"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
      },
    );
    expect(res).toBe(3);
  });

  it("allows onThrow to modify the error thrown by the computation", () => {
    const res = run(
      main(),
      (value) => value,
      (error) => {
        if (error instanceof Error) {
          return error.message;
        } else {
          return "";
        }
      },
      {
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
        "test/string"(_effect, _resume, abort) {
          return abort(new Error("ERROR"));
        },
      },
    );
    expect(res).toBe("ERROR");
  });

  it("throws if resume is called after the computation is resumed or aborted", () => {
    const onThrow = vi.fn((error: unknown): never => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error;
    });
    expect(() =>
      run(main(), (value) => value, onThrow, {
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
        "test/string"(effect, resume) {
          resume(effect.data.constraint(effect.data.value));
          return resume(effect.data.constraint(effect.data.value.toLowerCase()));
        },
      }),
    ).toThrowError("cannot resume; already resumed or aborted");
    expect(onThrow).toHaveBeenCalledWith(new Error("cannot resume; already resumed or aborted"));
  });

  it("throws if abort is called after the computation is resumed or aborted", () => {
    const onThrow = vi.fn((error: unknown): never => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error;
    });
    expect(() =>
      run(main(), (value) => value, onThrow, {
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
        "test/string"(effect, resume, abort) {
          resume(effect.data.constraint(effect.data.value));
          return abort(new Error("ERROR"));
        },
      }),
    ).toThrowError("cannot abort; already resumed or aborted");
    expect(onThrow).toHaveBeenCalledWith(new Error("cannot abort; already resumed or aborted"));
  });
});

describe("interpret", () => {
  function* main(): Effectful<"test/number" | "test/string", string> {
    const x = yield* number(3);
    const y = yield* string("A");
    return y.repeat(x);
  }

  it("translates some effects to other effects", () => {
    const comp = interpret<"test/string", "test/identity" | "test/number", string>(main(), {
      *"test/string"(effect, resume) {
        const value = yield* identity(effect.data.value);
        return yield* resume(effect.data.constraint(value));
      },
    });
    const res = run(
      comp,
      (value) => value,
      (error) => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw error;
      },
      {
        "test/identity"(effect, resume) {
          return resume(effect.data);
        },
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
      },
    );
    expect(res).toBe("AAA");
  });

  it("throws if resume is called after the computation is resumed or aborted", () => {
    const comp = interpret<"test/string", "test/identity" | "test/number", string>(main(), {
      *"test/string"(effect, resume) {
        yield* resume(effect.data.constraint(effect.data.value));
        return yield* resume(effect.data.constraint(effect.data.value.toLowerCase()));
      },
    });
    const onThrow = vi.fn((error: unknown): never => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error;
    });
    expect(() =>
      run(comp, (value) => value, onThrow, {
        "test/identity"(effect, resume) {
          return resume(effect.data);
        },
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
      }),
    ).toThrowError("cannot resume; already resumed or aborted");
    expect(onThrow).toHaveBeenCalledWith(new Error("cannot resume; already resumed or aborted"));
  });

  it("throws if abort is called after the computation is resumed or aborted", () => {
    const comp = interpret<"test/string", "test/identity" | "test/number", string>(main(), {
      *"test/string"(effect, resume, abort) {
        yield* resume(effect.data.constraint(effect.data.value));
        return yield* abort(new Error("ERROR"));
      },
    });
    const onThrow = vi.fn((error: unknown): never => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error;
    });
    expect(() =>
      run(comp, (value) => value, onThrow, {
        "test/identity"(effect, resume) {
          return resume(effect.data);
        },
        "test/number"(effect, resume) {
          return resume(effect.data.constraint(effect.data.value));
        },
      }),
    ).toThrowError("cannot abort; already resumed or aborted");
    expect(onThrow).toHaveBeenCalledWith(new Error("cannot abort; already resumed or aborted"));
  });
});

describe("runPure", () => {
  it("runs a pure computation", () => {
    // eslint-disable-next-line require-yield
    function* main(): Effectful<never, number> {
      return 42;
    }

    const res = runPure(main());
    expect(res).toBe(42);
  });
});

describe("runAsync", () => {
  it("runs an async computation", async () => {
    function* main(): Effectful<"async", number> {
      const x = yield* waitFor(Promise.resolve(42));
      let y;
      try {
        y = yield* waitFor(Promise.reject<number>(new Error("ERROR")));
      } catch {
        y = 1;
      }
      return x + y;
    }

    const res = runAsync(main());
    await expect(res).resolves.toBe(43);
  });

  it("rejects if a promise is rejected and not handled", async () => {
    function* main(): Effectful<"async", number> {
      const x = yield* waitFor(Promise.resolve(42));
      const y = yield* waitFor(Promise.reject<number>(new Error("ERROR")));
      return x + y;
    }
    const res = runAsync(main());
    await expect(res).rejects.toThrowError("ERROR");
  });
});
