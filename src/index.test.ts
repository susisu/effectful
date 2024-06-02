import { describe, it, expect } from "vitest";
import type { Effectful } from ".";
import { perform, run, pure, bind } from ".";

declare module "." {
  interface EffectDef<A> {
    "index.spec/identity": A;
  }
}

describe("run", () => {
  function* main(): Effectful<"index.spec/identity", number> {
    const x = yield* perform<"index.spec/identity", number>({
      id: "index.spec/identity",
      data: 42,
    });
    return x;
  }

  it("runs an effectful computation", () => {
    const res = run(main(), (x) => x, {
      "index.spec/identity": (eff, resume) => resume(eff.data),
    });
    expect(res).toBe(42);
  });

  it("allows the return handler to modify the return value of the computation", () => {
    const res = run(main(), (x) => x.toString(), {
      "index.spec/identity": (eff, resume) => resume(eff.data),
    });
    expect(res).toBe("42");
  });

  it("allows the effect handlers to abort the computation", () => {
    const res = run(main(), (x) => x, {
      "index.spec/identity": () => 666,
    });
    expect(res).toBe(666);
  });

  it("throws if resume is called more than once", () => {
    expect(() => {
      run(main(), (x) => x, {
        "index.spec/identity": (eff, resume) => {
          resume(eff.data);
          return resume(eff.data);
        },
      });
    }).toThrow("resume cannot be called more than once");
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
