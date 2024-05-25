import { describe, it, expect } from "vitest";
import { Effectful, makeEffect, run } from "./index.js";

declare module "./index.js" {
  interface EffectDef<A> {
    "index.spec/identity": A;
  }
}

describe("makeEffect", () => {
  it("constructs an effect object", () => {
    const eff = makeEffect<"index.spec/identity", number>("index.spec/identity", 42);
    expect(eff.kind).toBe("index.spec/identity");
    expect(eff.value).toBe(42);

    const it = eff[Symbol.iterator]();
    expect(it.next()).toEqual({
      done: false,
      value: eff,
    });
    expect(it.next()).toEqual({
      done: true,
      value: undefined,
    });
  });
});

describe("run", () => {
  const main = function* (): Effectful<"index.spec/identity", number> {
    const x = yield* makeEffect<"index.spec/identity", number>("index.spec/identity", 42);
    return x;
  };

  it("runs an effectful computation", () => {
    const res = run(main(), (x) => x, {
      "index.spec/identity": (eff, resume) => resume(eff.value),
    });
    expect(res).toBe(42);
  });

  it("allows the return handler to modify the return value of the computation", () => {
    const res = run(main(), (x) => x.toString(), {
      "index.spec/identity": (eff, resume) => resume(eff.value),
    });
    expect(res).toBe("42");
  });

  it("allows the effect handlers to abort the computation", () => {
    const res = run(main(), (x) => x.toString(), {
      "index.spec/identity": () => "xxx",
    });
    expect(res).toBe("xxx");
  });
});
