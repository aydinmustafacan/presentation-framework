"""Turns one HTTP request handed over by Java into a WSGI call on the Flask app."""
import io, sys
from app import app

def handle(method, path, query, headers, body):
    # headers: a Java Map<String,String>; body: a Java byte[]
    environ = {
        "REQUEST_METHOD": method,
        "SCRIPT_NAME": "",
        "PATH_INFO": path,
        "QUERY_STRING": query or "",
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "8080",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.version": (1, 0),
        "wsgi.url_scheme": "http",
        "wsgi.input": io.BytesIO(bytes(body)),
        "wsgi.errors": sys.stderr,
        "wsgi.multithread": False,
        "wsgi.multiprocess": False,
        "wsgi.run_once": False,
    }
    for name in headers.keySet():
        value = headers.get(name)
        key = name.upper().replace("-", "_")
        if key == "CONTENT_TYPE" or key == "CONTENT_LENGTH":
            environ[key] = value
        else:
            environ["HTTP_" + key] = value

    status_headers = []
    def start_response(status, response_headers, exc_info=None):
        status_headers[:] = [status, response_headers]

    chunks = app(environ, start_response)
    try:
        payload = b"".join(chunks)
    finally:
        if hasattr(chunks, "close"):
            chunks.close()
    status, response_headers = status_headers
    return int(status.split(" ", 1)[0]), [list(h) for h in response_headers], payload
