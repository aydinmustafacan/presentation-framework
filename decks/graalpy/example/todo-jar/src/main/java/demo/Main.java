package demo;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import org.graalvm.python.embedding.GraalPyResources;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;

/** Runs the Flask todo app (packed inside this JAR) behind the JDK's built-in HTTP server. */
public class Main {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        long t0 = System.nanoTime();

        // Python code + Flask come from the JAR's virtual filesystem; todos.json is written to the host disk.
        Context python = GraalPyResources.contextBuilder()
                .allowAllAccess(true)
                .build();
        Value handle = python.eval("python", "import wsgi_bridge; wsgi_bridge.handle");
        System.out.printf("Flask todo app imported in %d ms%n", (System.nanoTime() - t0) / 1_000_000);

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", exchange -> serve(python, handle, exchange));
        server.start();
        System.out.println("Todo app on http://localhost:" + port);
    }

    // One Python context is used by one thread at a time: serialise the calls.
    private static synchronized void serve(Context python, Value handle, HttpExchange ex) {
        try (ex) {
            Map<String, String> headers = new HashMap<>();
            ex.getRequestHeaders().forEach((k, v) -> headers.put(k, String.join(",", v)));
            byte[] body = ex.getRequestBody().readAllBytes();

            Value result = handle.execute(
                    ex.getRequestMethod(),
                    ex.getRequestURI().getPath(),
                    ex.getRequestURI().getRawQuery(),
                    headers,
                    body);

            int status = result.getArrayElement(0).asInt();
            Value hs = result.getArrayElement(1);
            for (long i = 0; i < hs.getArraySize(); i++) {
                Value h = hs.getArrayElement(i);
                ex.getResponseHeaders().add(h.getArrayElement(0).asString(), h.getArrayElement(1).asString());
            }
            Value payload = result.getArrayElement(2);
            byte[] out = new byte[(int) payload.getBufferSize()];
            payload.readBuffer(0, out, 0, out.length);
            ex.sendResponseHeaders(status, out.length == 0 ? -1 : out.length);
            if (out.length > 0) try (OutputStream os = ex.getResponseBody()) { os.write(out); }
        } catch (Exception e) {
            e.printStackTrace();
            try { ex.sendResponseHeaders(500, -1); } catch (Exception ignored) { }
        }
    }
}
