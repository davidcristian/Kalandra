/** Returns the line start of every row with this hash in an index that make-index-files sorted by hash. */
export function lineStartsByHash(
  index: Uint32Array,
  hash: number,
  rowSize: number,
): number[] {
  const rows = index.length / rowSize;
  let left = 0;
  let right = rows;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (index[mid * rowSize] < hash) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  const starts: number[] = [];
  for (let row = left; row < rows && index[row * rowSize] === hash; row += 1) {
    starts.push(index[row * rowSize + 1]);
  }
  return starts.sort((a, b) => a - b);
}
