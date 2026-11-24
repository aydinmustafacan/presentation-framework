# Flask in a JAR with GraalPy: the example behind the deck

`flask-jar/` is a real Maven project: a Flask app (`src/main/resources/org.graalvm.python.vfs/src/app.py`)
served by a Java `main()` (`src/main/java/demo/Main.java`) through a tiny WSGI bridge, built into one runnable JAR.
Every number in the deck comes from running it; `collect.mjs` turns the outputs into `../sections/_shared/measured.json`.

```bash
cd flask-jar
mvn package                                   # -> target/flask-jar-1.0.jar (~84 MB)
java -jar target/flask-jar-1.0.jar 8080       # Java owns the socket (default)
java -jar target/flask-jar-1.0.jar 8080 --werkzeug   # Flask's own dev server instead
curl localhost:8080/  /info  /fib/90  /primes/200000  /where
```

Measurements (GraalVM JDK path is wherever you unpacked GraalVM CE 25):

```bash
./bench.sh java openjdk                      # 40 x /primes on the current JDK   -> bench-openjdk.txt
./bench.sh $GRAALVM/bin/java graalvm2        # same on a GraalVM JDK (JIT)        -> bench-graalvm2.txt
./startup.sh java openjdk && ./startup.sh $GRAALVM/bin/java graalvm   # cold starts -> startup-*.txt
# compilation trace: start with -Dpolyglot.engine.TraceCompilation=true -Dpolyglot.log.file=$PWD/trace-graalvm.log,
# append MARK-READY / MARK-REQn lines between requests, record latencies in trace-requests.txt
java -cp target/flask-jar-1.0.jar snippets/Snippet.java    # boundary conversions -> snippets/Snippet.out
java -cp target/flask-jar-1.0.jar snippets/VfsCheck.java   # meta_path, read-only VFS -> snippets/VfsCheck.out
cd .. && node collect.mjs                    # -> ../sections/_shared/measured.json
```

Measured on an Apple M1 Pro with GraalPy 25.0.5, Corretto 25.0.1 and GraalVM CE 25.0.1. `startup-cpython.txt` holds
`time python -c "import app"` on CPython 3.13 with Flask 3.1.3 installed in a venv.
