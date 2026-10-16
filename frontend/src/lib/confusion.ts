export interface ConfusionPair {
  actual: number;
  predicted: number;
  count: number;
}

export function topConfusions(matrix: number[][], labels: number[], limit = 3): ConfusionPair[] {
  const pairs: ConfusionPair[] = [];
  matrix.forEach((row, rowIndex) => {
    row.forEach((count, columnIndex) => {
      const actual = labels[rowIndex];
      const predicted = labels[columnIndex];
      if (rowIndex === columnIndex || actual === undefined || predicted === undefined) return;
      pairs.push({ actual, predicted, count });
    });
  });
  return pairs.sort((left, right) => right.count - left.count || left.actual - right.actual).slice(0, limit);
}
