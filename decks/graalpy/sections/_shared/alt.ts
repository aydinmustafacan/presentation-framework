/**
 * Chapter 4: GraalPy vs Jython vs JEP. Every number comes from ../../example/alternatives
 * (run.sh x3 per runtime -> collect.mjs -> alternatives.json); the code shown is the harnesses' own source.
 */
import alt from './alternatives.json';
import jythonJava from '../../example/alternatives/JythonRun.java?raw';
import jepJava from '../../example/alternatives/JepRun.java?raw';
import graalpyJava from '../../example/alternatives/GraalPyRun.java?raw';
import workloadPy from '../../example/alternatives/workload.py?raw';
import { M, steady } from './data.ts';

export const A = alt;
export { workloadPy };

export type RtId = 'jython' | 'jep' | 'graalpy';
export const RT_IDS: RtId[] = ['jython', 'jep', 'graalpy'];

/** Colour per runtime for this chapter: GraalPy keeps the deck's orange, Jython teal, JEP yellow. */
export const RT: Record<RtId, { name: string; tone: string; version: string; source: string; how: string }> = {
  jython: { name: 'Jython', tone: 'teal', version: `Jython ${alt.versions.jython}`, source: jythonJava, how: 'Python compiled to JVM bytecode' },
  jep: { name: 'JEP', tone: 'yellow', version: `JEP ${alt.versions.jep} + CPython ${alt.versions.cpython}`, source: jepJava, how: 'real CPython, in-process over JNI' },
  graalpy: { name: 'GraalPy', tone: 'accent', version: `GraalPy ${alt.versions.graalpy}`, source: graalpyJava, how: 'Python 3 interpreter on Truffle' },
};

/** Trimmed text of the first line containing each needle, in order (throws if a harness changed, so the build fails loudly). */
export function pick(src: string, ...needles: string[]): string {
  const lines = src.split('\n');
  return needles.map((n) => {
    const l = lines.find((x) => x.includes(n));
    if (!l) throw new Error(`"${n}" not found in harness source`);
    return l.trim();
  }).join('\n');
}

/** GraalPy on a GraalVM JDK (JIT on) is not in this harness run; the deck's Flask measurement (ch1.4) is the reference. */
export const graalvmFlaskSteady = steady(M.bench.graalvm.ms);
export const openjdkFlaskSteady = steady(M.bench.openjdk.ms);

export const jythonJarBytes = 50453449;
export const fatJarBytes = M.jar.size;
