// Shared timing/JSON helpers, compiled together with each harness.
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;

class Common {
    static final int PRIMES_N = 200000, RUNS = 15, THREADS = 4, THREAD_N = 100000;
    static final StringBuilder out = new StringBuilder("{");
    static void put(String k, Object v) { if (out.length() > 1) out.append(",\n "); out.append('"').append(k).append("\": ").append(json(v)); }
    static String json(Object v) {
        if (v == null) return "null";
        if (v instanceof Number || v instanceof Boolean) return v.toString();
        if (v instanceof List<?> l) { StringJoiner j = new StringJoiner(", ", "[", "]"); for (Object o : l) j.add(json(o)); return j.toString(); }
        return '"' + v.toString().replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + '"';
    }
    static void done() { System.out.println(out.append("}")); }
    static String firstLine(Throwable e) { String m = String.valueOf(e.getMessage()); return e.getClass().getSimpleName() + ": " + m.split("\n")[0]; }
    static Map<String, String> headers() { Map<String, String> m = new HashMap<>(); m.put("Host", "x"); return m; }
    static final byte[] BODY = {104, 105};
    static double ms(long t0) { return Math.round((System.nanoTime() - t0) / 1e5) / 10.0; }

    /** Each of `threads` threads builds its own interpreter (not timed), waits at a barrier, then runs primes(THREAD_N) once. Returns wall ms of the timed part. */
    static double parallel(int threads, Supplier<IntSupplier> perThread) throws Exception {
        CyclicBarrier ready = new CyclicBarrier(threads + 1), finished = new CyclicBarrier(threads + 1);
        List<Thread> ts = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            Thread t = new Thread(() -> {
                try { IntSupplier job = perThread.get(); ready.await(); job.getAsInt(); finished.await(); }
                catch (Exception e) { e.printStackTrace(); ready.reset(); finished.reset(); }
            });
            t.start(); ts.add(t);
        }
        ready.await(); long t0 = System.nanoTime(); finished.await(); double r = ms(t0);
        for (Thread t : ts) t.join();
        return r;
    }
}
