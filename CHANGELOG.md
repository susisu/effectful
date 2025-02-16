## 0.7.0 (2025-02-16)

- Simplify the `interpret` function
- Fix `onThrow` (the thrid argument of `run`) not to be called twice
- **BREAKING** The previous `interpret` function has been renamed to `handle`

## 0.6.2 (2025-02-10)

- Fix `waitFor` and `runAsync` to return awaited types

## 0.6.1 (2025-02-03)

- Fix handling of errors thrown by effect handlers

## 0.6.0 (2025-02-02)

- Add proper support for `try` / `catch` / `finally` in computations
- Add new features
  - `abort`, `runPure`, `waitFor`, and `runAsync` functions
  - the optional third argument `onThrow` of `bind`
  - `async` effect
- **BREAKING** `run` now takes two functions `onReturn` and `onThrow`, instead of a single function `ret`, to handle errors thrown in the computations
- **BREAKING** Rename `EffectId` to `EffectKey`
- **BREAKING** The arguments of `Eff` type is flipped (`Eff<Row, T>` to `Eff<T, Row>`) for convenience
