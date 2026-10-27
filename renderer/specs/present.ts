/** Returns the value with its type narrowed, and fails the test when the value is undefined or null. */
export function present<T>(value: T): NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error("The test expected a value and found none");
  }
  return value;
}
