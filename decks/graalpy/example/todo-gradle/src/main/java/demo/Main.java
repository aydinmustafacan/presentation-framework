package demo;

import org.graalvm.python.embedding.GraalPyResources;

/** The only Java: open a Python context on the JAR's virtual filesystem and let Flask serve. */
public class Main {
    public static void main(String[] args) {
        String port = args.length > 0 ? args[0] : "8080";
        GraalPyResources.contextBuilder().allowAllAccess(true).build()
                .eval("python", "from app import app; app.run(port=" + Integer.parseInt(port) + ")");
    }
}
