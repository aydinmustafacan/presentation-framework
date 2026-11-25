// Jython 2.7.4. Run: ./run.sh jython
import org.python.core.*;
import org.python.util.PythonInterpreter;
import java.nio.file.*;
import java.util.*;

public class JythonRun extends Common {
    public static void main(String[] a) throws Exception {
        String src = Files.readString(Path.of("workload.py"));
        long t0 = System.nanoTime();
        PythonInterpreter py = new PythonInterpreter();
        py.exec(src);
        put("runtime", "Jython");
        put("startupMs", ms(t0));
        put("python", py.eval("sys.version.split()[0]").toString());
        try { py.exec(py.get("FSTRING").toString()); put("fstring", "ok"); } catch (PyException e) { put("fstring", e.toString().trim().split("\n")[e.toString().trim().split("\n").length - 1]); }
        try { py.exec(py.get("NUMPY").toString()); put("numpy", "ok " + py.get("r")); } catch (PyException e) { put("numpy", e.toString().trim().split("\n")[e.toString().trim().split("\n").length - 1]); }

        PyObject r = py.get("probe").__call__(new PyObject[]{ Py.java2py(headers()), Py.java2py(BODY), Py.java2py("java string") });
        List<Object> seen = new ArrayList<>();
        for (PyObject e : ((PyTuple) r).getArray()) seen.add(e.toString());
        put("probeSeenByPython", seen);
        put("probeReturnedToJava", r.getClass().getName());
        put("probeElement0InJava", ((PyTuple) r).get(0).getClass().getName());

        PyObject primes = py.get("primes");
        List<Object> runs = new ArrayList<>();
        int count = 0;
        for (int i = 0; i < RUNS; i++) { long t = System.nanoTime(); count = primes.__call__(new PyInteger(PRIMES_N)).asInt(); runs.add(ms(t)); }
        put("primes", count); put("primesMs", runs);

        java.util.function.Supplier<java.util.function.IntSupplier> mk = () -> {
            PythonInterpreter p = new PythonInterpreter(); p.exec(src); PyObject f = p.get("primes");
            return () -> f.__call__(new PyInteger(THREAD_N)).asInt();
        };
        parallel(THREADS, mk); // warm-up
        put("thread1Ms", parallel(1, mk)); put("threadNMs", parallel(THREADS, mk)); put("threads", THREADS);
        put("threadNote", "one PythonInterpreter per thread; Jython has no GIL");
        done();
    }
}
