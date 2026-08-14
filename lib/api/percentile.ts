// Percentile of an already-sorted numeric array, using linear interpolation
// between closest ranks
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) throw new Error("Cannot compute a percentile of an empty array");
  if (p < 0 || p > 100) throw new Error(`Percentile must be between 0 and 100, got ${p}`);

  const n = sortedValues.length;
  if (n === 1) return sortedValues[0];

  const index = (p / 100) * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];

  const frac = index - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * frac;
}
