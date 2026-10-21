import { setProperty } from "dot-prop";

type Leaf = string | number | boolean | null | undefined;

/** Every dot path from an object to a value that is not an object, through optional and union members. */
export type LeafPath<T> = T extends Leaf
  ? never
  : {
      [K in keyof T & string]-?: NonNullable<T[K]> extends Leaf
        ? K
        : `${K}.${LeafPath<NonNullable<T[K]>>}`;
    }[keyof T & string];

/** The type of the value at a dot path of an object. */
export type PathValue<T, P extends string> = T extends Leaf
  ? never
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? PathValue<NonNullable<T[K]>, Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

/** Sets the value at a dot path of an object, with the path and the value checked against the object's type. */
export function propSet<T extends object, P extends LeafPath<T>>(
  object: T,
  path: P,
  value: PathValue<T, P>,
): void {
  setProperty(object, path, value);
}
