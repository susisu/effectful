import { describe, it, expect } from "vitest";
import type { Effectful } from ".";
import { perform, map, pure, bind, run, handle } from ".";

declare module "." {
  interface EffectRegistry<T> {
    "index.test/identity": T;
    "index.test/call": () => T;
  }
}

describe("perform, run", () => {
  function* main(): Effectful<"index.test/identity", number> {
    const x = yield* perform<"index.test/identity", number>({
      id: "index.test/identity",
      data: 42,
    });
    return x;
  }

  it("runs an effectful computation", () => {
    const res = run(main(), (x) => x, {
      "index.test/identity": (eff, resume) => resume(eff.data),
    });
    expect(res).toBe(42);
  });

  it("allows the return handler to modify the return value of the computation", () => {
    const res = run(main(), (x) => x.toString(), {
      "index.test/identity": (eff, resume) => resume(eff.data),
    });
    expect(res).toBe("42");
  });

  it("allows the effect handlers to abort the computation", () => {
    const res = run(main(), (x) => x, {
      "index.test/identity": () => 666,
    });
    expect(res).toBe(666);
  });

  it("throws if resume is called more than once", () => {
    expect(() => {
      run(main(), (x) => x, {
        "index.test/identity": (eff, resume) => {
          resume(eff.data);
          return resume(eff.data);
        },
      });
    }).toThrow("resume cannot be called more than once");
  });
});

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

describe("handle", () => {
  function* main(): Effectful<"index.test/identity" | "index.test/call", number> {
    const x = yield* perform<"index.test/identity", number>({
      id: "index.test/identity",
      data: 42,
    });
    const y = yield* perform<"index.test/call", number>({
      id: "index.test/call",
      data: () => 2,
    });
    return x * y;
  }

  it("handles a subset of effects", () => {
    const comp = handle(main(), (x) => pure(x), {
      "index.test/call": (eff, resume) => bind(pure(eff.data()), resume),
    });
    const res = run(comp, (x) => x, {
      "index.test/identity": (eff, resume) => resume(eff.data),
    });
    expect(res).toBe(84);
  });

  it("throws if resume is called more than once", () => {
    const comp = handle(main(), (x) => pure(x), {
      "index.test/call": (eff, resume) => {
        resume(eff.data());
        return bind(pure(eff.data()), resume);
      },
    });
    expect(() => {
      run(comp, (x) => x, {
        "index.test/identity": (eff, resume) => resume(eff.data),
      });
    }).toThrow("resume cannot be called more than once");
  });
});
