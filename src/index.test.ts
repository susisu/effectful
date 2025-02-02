import { describe, it, expect } from "vitest";
import type { Effectful } from "./index.js";
import { perform, map, pure, bind, run, interpret } from "./index.js";

declare module "./index.js" {
  interface EffectRegistry<T> {
    "index.test/identity": T;
    "index.test/call": () => T;
  }
}

function identity<T>(value: T): Effectful<"index.test/identity", T> {
  return perform({
    id: "index.test/identity",
    data: value,
  });
}

function call<T>(func: () => T): Effectful<"index.test/call", T> {
  return perform({
    id: "index.test/call",
    data: func,
  });
}

describe("map", () => {
  it("maps the return value of a computation", () => {
    const comp = pure<never, number>(42);
    const func = (x: number): string => x.toString();
    const res = run(map(comp, func), (x) => x, {});
    expect(res).toBe("42");
  });
});

describe("pure", () => {
  it("creates a computation that returns the given value without performing any effect", () => {
    const comp = pure<never, number>(42);
    const res = run(comp, (x) => x, {});
    expect(res).toBe(42);
  });
});

describe("bind", () => {
  it("composes two computations sequentially", () => {
    const comp = pure<never, number>(42);
    const func = (x: number): Effectful<never, string> => pure(x.toString());
    const res = run(bind(comp, func), (x) => x, {});
    expect(res).toBe("42");
  });
});

describe("run", () => {
  function* main(): Effectful<"index.test/identity", number> {
    const x = yield* identity(42);
    return x;
  }

  it("runs an effectful computation", () => {
    const res = run(main(), (x) => x, {
      "index.test/identity"(eff, resume) {
        return resume(eff.data);
      },
    });
    expect(res).toBe(42);
  });

  it("allows the return handler to modify the return value of the computation", () => {
    const res = run(main(), (x) => x.toString(), {
      "index.test/identity"(eff, resume) {
        return resume(eff.data);
      },
    });
    expect(res).toBe("42");
  });

  it("allows the effect handlers to abort the computation", () => {
    const res = run(main(), (x) => x, {
      "index.test/identity"(_eff, _resume) {
        return 666;
      },
    });
    expect(res).toBe(666);
  });

  it("throws if resume is called more than once", () => {
    expect(() => {
      run(main(), (x) => x, {
        "index.test/identity"(eff, resume) {
          resume(eff.data);
          return resume(eff.data);
        },
      });
    }).toThrow("resume cannot be called more than once");
  });
});

describe("interpret", () => {
  function* main(): Effectful<"index.test/identity" | "index.test/call", number> {
    const x = yield* identity(1);
    const y = yield* call(() => 2);
    const z = yield* identity(4);
    const w = yield* call(() => 8);
    return x + y + z + w;
  }

  it("re-interprets a subset of effects", () => {
    const comp = interpret<"index.test/call", "index.test/identity", number>(main(), {
      *"index.test/call"(eff, resume) {
        const v = yield* identity(eff.data());
        return yield* resume(v);
      },
    });
    const res = run(comp, (x) => x, {
      "index.test/identity"(eff, resume) {
        return resume(eff.data);
      },
    });
    expect(res).toBe(15);
  });

  it("throws if resume is called more than once", () => {
    const comp = interpret<"index.test/call", "index.test/identity", number>(main(), {
      *"index.test/call"(eff, resume) {
        yield* resume(eff.data());
        return yield* resume(eff.data());
      },
    });
    expect(() => {
      run(comp, (x) => x, {
        "index.test/identity"(eff, resume) {
          return resume(eff.data);
        },
      });
    }).toThrow("resume cannot be called more than once");
  });
});
