/**
 * Everything measured from the real example project in ../../example/flask-jar,
 * collected by ../../example/collect.mjs. Nothing in here is hand-written.
 */
import measured from './measured.json';

export const M = measured;
export type JarCategory = (typeof measured.jar.categories)[number];
export type TraceEvent = (typeof measured.trace)[number];

export const MB = (b: number, digits = 1) => `${(b / 1e6).toFixed(digits)} MB`;
export const KB = (b: number) => (b < 1e6 ? `${Math.round(b / 1e3)} kB` : MB(b));
export const sec = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

export const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Steady state = median of the last 10 requests of the 40-request run. */
export const steady = (xs: readonly number[]) => median(xs.slice(-10));

export const V = measured.versions;
