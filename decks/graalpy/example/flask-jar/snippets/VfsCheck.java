// Run: java -cp target/flask-jar-1.0.jar snippets/VfsCheck.java   (output: snippets/VfsCheck.out)
import org.graalvm.polyglot.*;
import org.graalvm.python.embedding.GraalPyResources;

public class VfsCheck {
    public static void main(String[] a) {
        try (Context ctx = GraalPyResources.contextBuilder().build()) {
            ctx.eval("python", """
import sys
print("meta_path:", [type(f).__name__ if not isinstance(f, type) else f.__name__ for f in sys.meta_path])
print("sys spec origin:", sys.__spec__.origin)
try:
    open("/graalpy_vfs/src/new.txt", "w").write("x")
    print("write into VFS: ok")
except Exception as e:
    print("write into VFS:", type(e).__name__, e)
try:
    import markupsafe._speedups
    print("markupsafe._speedups: imported")
except ImportError as e:
    print("markupsafe._speedups: ImportError")
import os
print("listdir /graalpy_vfs:", sorted(os.listdir("/graalpy_vfs")))
""");
        }
    }
}
