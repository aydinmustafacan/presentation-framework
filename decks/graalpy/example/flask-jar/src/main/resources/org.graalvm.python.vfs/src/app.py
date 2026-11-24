from flask import Flask, jsonify, request
import sys, platform

app = Flask(__name__)

@app.get("/")
def index():
    return "Hello from Flask, running on " + sys.implementation.name + "!\n"

@app.get("/info")
def info():
    return jsonify(
        implementation=sys.implementation.name,
        python=platform.python_version(),
        java=__import__("java").type("java.lang.System").getProperty("java.version"),
    )

@app.get("/fib/<int:n>")
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return jsonify(n=n, fib=str(a))

@app.post("/echo")
def echo():
    return jsonify(got=request.get_json(silent=True), method=request.method)

@app.get("/primes/<int:n>")
def primes(n):
    # deliberately plain Python loops: a CPU-bound request to compare JIT vs interpreter
    count = 0
    for k in range(2, n):
        d = 2
        while d * d <= k:
            if k % d == 0:
                break
            d += 1
        else:
            count += 1
    return jsonify(n=n, primes=count)

@app.get("/where")
def where():
    # where does each import come from when the app runs from inside the JAR?
    import json, markupsafe, werkzeug, os
    from markupsafe import _escape_inner
    return jsonify(
        sys_path=sys.path,
        prefix=sys.prefix,
        executable=sys.executable,
        flask=__import__("flask").__file__,
        werkzeug=werkzeug.__file__,
        json=json.__file__,
        app=__file__,
        markupsafe_escape=_escape_inner.__module__,
        os_name=os.name,
        platform=sys.platform,
    )
