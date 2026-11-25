// JEP 4.4 embedding the venv's CPython. Run: ./run.sh jep
import jep.*;
import java.nio.file.*;
import java.util.*;

public class JepRun extends Common {
    public static void main(String[] a) throws Exception {
        String site = System.getProperty("site");
        MainInterpreter.setJepLibraryPath(site + "/jep/libjep.jnilib");
        JepConfig cfg = new JepConfig().addIncludePaths(site, ".");
        SharedInterpreter.setConfig(cfg);
        String src = Files.readString(Path.of("workload.py"));
        long t0 = System.nanoTime();
        SharedInterpreter py = new SharedInterpreter();
        py.exec(src);
        put("runtime", "JEP");
        put("startupMs", ms(t0));
        put("python", py.getValue("sys.version.split()[0]", String.class));
        try { py.exec((String) py.getValue("FSTRING")); put("fstring", "ok"); } catch (JepException e) { put("fstring", firstLine(e)); }
        try { py.exec((String) py.getValue("NUMPY")); put("numpy", "ok " + py.getValue("r")); } catch (JepException e) { put("numpy", firstLine(e)); }

        Object r = py.invoke("probe", headers(), BODY, "java string");
        py.set("_hm", headers()); py.set("_bb", BODY); py.set("_ss", "java string");
        List<Object> seen = new ArrayList<>((List<?>) py.getValue("[str(x) for x in probe(_hm, _bb, _ss)]", List.class));
        put("probeSeenByPython", seen);
        put("probeReturnedToJava", r.getClass().getName());
        put("probeElement0InJava", ((List<?>) r).get(0).getClass().getName());

        List<Object> runs = new ArrayList<>();
        Object count = null;
        for (int i = 0; i < RUNS; i++) { long t = System.nanoTime(); count = py.invoke("primes", PRIMES_N); runs.add(ms(t)); }
        put("primes", count); put("primesMs", runs);

        java.util.function.Supplier<java.util.function.IntSupplier> shared = () -> {
            SharedInterpreter p = new SharedInterpreter(); p.exec(src);
            return () -> ((Number) p.invoke("primes", THREAD_N)).intValue();
        };
        java.util.function.Supplier<java.util.function.IntSupplier> isolated = () -> {
            try {
                SubInterpreter p = new SubInterpreter(new JepConfig().addIncludePaths(site, ".").setSubInterpreterOptions(SubInterpreterOptions.isolated()));
                p.exec(src);
                return () -> ((Number) p.invoke("primes", THREAD_N)).intValue();
            } catch (JepException e) { throw new RuntimeException(e); }
        };
        parallel(THREADS, shared);
        put("thread1Ms", parallel(1, shared)); put("threadNMs", parallel(THREADS, shared)); put("threads", THREADS);
        put("threadNote", "one SharedInterpreter per thread; they share CPython's GIL");
        try {
            parallel(THREADS, isolated);
            put("isolated1Ms", parallel(1, isolated)); put("isolatedNMs", parallel(THREADS, isolated));
        } catch (Exception e) { put("isolatedError", firstLine(e.getCause() != null ? e.getCause() : e)); }
        Thread nt = new Thread(() -> {
            try (SubInterpreter p = new SubInterpreter(new JepConfig().addIncludePaths(site, ".").setSubInterpreterOptions(SubInterpreterOptions.isolated()))) {
                p.exec("import numpy"); put("isolatedNumpy", "ok");
            } catch (Exception e) { put("isolatedNumpy", firstLine(e)); }
        });
        nt.start(); nt.join();
        done();
        System.exit(0);
    }
}
