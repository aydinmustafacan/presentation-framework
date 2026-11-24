export interface Snap { lo: number; hi: number; mid: number | null; note: string; done: boolean; found: number | null; comparisons: number }

export function trace(xs: number[], target: number): Snap[] {
  let lo = 0, hi = xs.length - 1, comparisons = 0;
  const out: Snap[] = [{ lo, hi, mid: null, note: `Search ${xs.length} sorted values for ${target}. The answer, if present, is somewhere in [${lo}, ${hi}].`, done: false, found: null, comparisons }];
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    comparisons++;
    if (xs[mid] === target) {
      out.push({ lo, hi, mid, note: `xs[${mid}] = ${xs[mid]} — found it after ${comparisons} comparison${comparisons > 1 ? 's' : ''}.`, done: true, found: mid, comparisons });
      return out;
    }
    const goRight = xs[mid] < target;
    out.push({ lo, hi, mid, note: `xs[${mid}] = ${xs[mid]} is ${goRight ? 'less' : 'greater'} than ${target}, so everything ${goRight ? 'left of and including' : 'right of and including'} index ${mid} is ruled out.`, done: false, found: null, comparisons });
    if (goRight) lo = mid + 1; else hi = mid - 1;
  }
  out.push({ lo, hi, mid: null, note: `The range is empty (lo ${lo} > hi ${hi}): ${target} is not in the list. ${comparisons} comparisons.`, done: true, found: null, comparisons });
  return out;
}
