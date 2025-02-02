## 0.6.0 (2025-02-02)

- Add proper support for `try` / `catch` / `finally` in computations
- Add new features
  - `abort`, `runPure`, `waitFor`, and `runAsync` functions
  - the optional third argument `onThrow` of `bind`
  - `async` effect
- **BREAKING** `run` now takes two functions `onReturn` and `onThrow`, instead of a single function `ret`, to handle errors thrown in the computations
- **BREAKING** Rename `EffectId` to `EffectKey`
- **BREAKING** The arguments of `Eff` type is flipped (`Eff<Row, T>` to `Eff<T, Row>`) for convenience

