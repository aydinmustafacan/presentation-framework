// Run: java -cp target/flask-jar-1.0.jar snippets/Snippet.java   (output: snippets/Snippet.out)
import org.graalvm.polyglot.*;
import java.util.*;

public class Snippet {
    public static void main(String[] a) {
        try (Context ctx = Context.create("python")) {
            Value r = ctx.eval("python", "sum(range(10))");
            System.out.println("sum=" + r.asInt());
        }
        try (Context ctx = Context.newBuilder("python").allowAllAccess(true).build()) {
            Value f = ctx.eval("python", "def f(m, b, s):\n    return (type(m).__name__, type(b).__name__, type(s).__name__, list(m.keySet()), bytes(b), len(b), s.upper())\nf");
            Value t = f.execute(Map.of("Host", "x"), new byte[]{104, 105}, "java string");
            System.out.println("tuple: hasArrayElements=" + t.hasArrayElements() + " size=" + t.getArraySize());
            for (int i = 0; i < t.getArraySize(); i++) {
                Value e = t.getArrayElement(i);
                System.out.println(i + ": " + e + "  buffer=" + e.hasBufferElements() + " string=" + e.isString() + " array=" + e.hasArrayElements());
            }
            Value d = ctx.eval("python", "{'a': 1}");
            System.out.println("dict: hasHashEntries=" + d.hasHashEntries() + " hasMembers=" + d.hasMembers());
        }
        try (Context ctx = Context.create("python")) {
            ctx.eval("python", "import java");
            System.out.println("import java without host access: ok");
            try { ctx.eval("python", "java.type('java.lang.System')"); System.out.println("java.type ok"); }
            catch (PolyglotException e) { System.out.println("java.type denied: " + e.getMessage()); }
        } catch (PolyglotException e) { System.out.println("import java failed: " + e.getMessage()); }
    }
}
