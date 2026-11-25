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

## Todo app in a JAR

`todo-jar/` is the same setup applied to a small real app: a Flask todo list with Jinja-rendered HTML pages
(plain forms, no JavaScript) and a JSON API. Code and templates ship inside the JAR; todos are saved to
`TODO_FILE` (default `./todos.json`) on the host disk, so they survive restarts.

```bash
cd todo-jar
mvn package                                   # -> target/todo-jar-1.0.jar (~84 MB)
java -jar target/todo-jar-1.0.jar 8080        # open http://localhost:8080
curl -XPOST localhost:8080/api/todos -H 'Content-Type: application/json' -d '{"title":"Write slides"}'
curl -XPATCH localhost:8080/api/todos/1 -H 'Content-Type: application/json' -d '{"done":true}'
curl localhost:8080/api/todos                 # GET/POST /api/todos, GET/PATCH/DELETE /api/todos/<id>
```

Note: GraalPy's filesystem rejects `os.replace` ("Atomic move not supported"), so the app overwrites the file directly.

## Todo app with Gradle and minimal Java

`todo-gradle/` builds the same todo app with Gradle instead of Maven. Its only Java is a short
`Main.java` that opens the GraalPy context and calls `app.run()`, so Flask's own (Werkzeug) server
handles HTTP and no Java bridge is needed. The Python code is a copy of todo-jar's (the GraalPy Gradle plugin
only indexes the project's own `src/main/resources/org.graalvm.python.vfs`).

```bash
cd todo-gradle
gradle shadowJar                              # Gradle 9.1+ on JDK 25 -> build/libs/todo-gradle-1.0.jar (~84 MB)
java -jar build/libs/todo-gradle-1.0.jar 8080 # open http://localhost:8080
```

Two Shadow settings are required: GraalPy's `python` / `python-community` artifacts are POM-only and must be
excluded from the fat JAR, and `duplicatesStrategy = INCLUDE` is needed so `mergeServiceFiles()` keeps every
Truffle language (without it only `python` is registered and `import re` fails with "No language for id regex").
