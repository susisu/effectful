/**
 * `Single<T>` rejects union types.
 */
export type Single<T> = IsSingle<T> extends true ? T : never;

type IsSingle<T, U = T> = T extends unknown ? ([U] extends [T] ? true : false) : never;
