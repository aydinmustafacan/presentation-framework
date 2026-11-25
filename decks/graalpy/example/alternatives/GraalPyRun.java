// GraalPy 25.0.5 (polyglot API from the flask-jar JAR). Run: ./run.sh graalpy
import org.graalvm.polyglot.*;
import java.nio.file.*;
import java.util.*;

public class GraalPyRun extends Common {
    public static void main(String[] a) throws Exception {
        String src = Files.readString(Path.of("workload.py"));
        long t0 = System.nanoTime();
        Engine engine = Engine.newBuilder("python").option("engine.WarnInterpreterOnly", "false").build();
        Context py = Context.newBuilder("python").engine(engine).allowAllAccess(true).build();
        py.eval("python", src);
        Value g = py.getBindings("python");
        put("runtime", "GraalPy");
        put("startupMs", ms(t0));
        put("python", py.eval("python", "sys.version.split()[0]").asString());
        try { py.eval("python", g.getMember("FSTRING").asString()); put("fstring", "ok"); } catch (PolyglotException e) { put("fstring", firstLine(e)); }
        try { py.eval("python", g.getMember("NUMPY").asString()); put("numpy", "ok " + g.getMember("r")); } catch (PolyglotException e) { put("numpy", firstLine(e)); }

        Value r = g.getMember("probe").execute(headers(), BODY, "java string");
        List<Object> seen = new ArrayList<>();
        for (long i = 0; i < r.getArraySize(); i++) { Value e = r.getArrayElement(i); seen.add(e.isString() ? e.asString() : e.toString()); }
        put("probeSeenByPython", seen);
        put("probeReturnedToJava", r.getClass().getName() + " (hasArrayElements=" + r.hasArrayElements() + ")");
        put("probeElement0InJava", r.getArrayElement(0).getClass().getName());

        Value primes = g.getMember("primes");
        List<Object> runs = new ArrayList<>();
        int count = 0;
        for (int i = 0; i < RUNS; i++) { long t = System.nanoTime(); count = primes.execute(PRIMES_N).asInt(); runs.add(ms(t)); }
        put("primes", count); put("primesMs", runs);

        java.util.function.Supplier<java.util.function.IntSupplier> mk = () -> {
            Context c = Context.newBuilder("python").engine(engine).allowAllAccess(true).build();
            c.eval("python", src); Value f = c.getBindings("python").getMember("primes");
            return () -> f.execute(THREAD_N).asInt();
        };
        parallel(THREADS, mk);
        put("thread1Ms", parallel(1, mk)); put("threadNMs", parallel(THREADS, mk)); put("threads", THREADS);
        put("threadNote", "one Context per thread, sharing one Engine; each Context has its own GIL");
        put("jvm", System.getProperty("java.vm.name") + " " + System.getProperty("java.version"));
        done();
        System.exit(0);
    }
}
