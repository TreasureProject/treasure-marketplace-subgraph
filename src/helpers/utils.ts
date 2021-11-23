export function removeAtIndex<T>(array: T[], index: i32): T[] {
  return array.slice(0, index).concat(array.slice(index + 1));
}
