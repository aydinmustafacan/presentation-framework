"""A small todo app: an HTML page plus a JSON API, saved to a JSON file on the host disk.

The code and templates live in the JAR's read-only virtual filesystem; the data file lives
outside it (TODO_FILE, default ./todos.json), so todos survive restarts.
"""
import json, os, sys, threading
from flask import Flask, jsonify, redirect, render_template, request, url_for, abort

app = Flask(__name__)
DATA_FILE = os.path.abspath(os.environ.get("TODO_FILE", "todos.json"))
_lock = threading.Lock()


def _load():
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"next_id": 1, "todos": []}


def _save(data):
    # Plain overwrite: GraalPy's VFS-backed filesystem rejects os.replace ("Atomic move not supported").
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _find(data, todo_id):
    for t in data["todos"]:
        if t["id"] == todo_id:
            return t
    abort(404)


def add_todo(title):
    title = (title or "").strip()
    if not title:
        abort(400, "title is required")
    with _lock:
        data = _load()
        todo = {"id": data["next_id"], "title": title[:200], "done": False}
        data["next_id"] += 1
        data["todos"].append(todo)
        _save(data)
    return todo


def update_todo(todo_id, **changes):
    with _lock:
        data = _load()
        todo = _find(data, todo_id)
        if "title" in changes:
            title = (changes["title"] or "").strip()
            if not title:
                abort(400, "title is required")
            todo["title"] = title[:200]
        if "done" in changes:
            todo["done"] = bool(changes["done"])
        _save(data)
    return todo


def delete_todo(todo_id):
    with _lock:
        data = _load()
        _find(data, todo_id)
        data["todos"] = [t for t in data["todos"] if t["id"] != todo_id]
        _save(data)


# ---------- HTML pages (plain forms, no JavaScript needed) ----------

@app.get("/")
def index():
    show = request.args.get("show", "all")
    todos = _load()["todos"]
    left = sum(1 for t in todos if not t["done"])
    if show == "active":
        todos = [t for t in todos if not t["done"]]
    elif show == "done":
        todos = [t for t in todos if t["done"]]
    return render_template("index.html", todos=todos, left=left, show=show,
                           runtime=sys.implementation.name, data_file=DATA_FILE)


@app.post("/todos")
def create_form():
    add_todo(request.form.get("title"))
    return redirect(url_for("index"))


@app.post("/todos/<int:todo_id>/toggle")
def toggle_form(todo_id):
    todo = _find(_load(), todo_id)
    update_todo(todo_id, done=not todo["done"])
    return redirect(request.referrer or url_for("index"))


@app.post("/todos/<int:todo_id>/delete")
def delete_form(todo_id):
    delete_todo(todo_id)
    return redirect(request.referrer or url_for("index"))


@app.post("/todos/clear-done")
def clear_done_form():
    with _lock:
        data = _load()
        data["todos"] = [t for t in data["todos"] if not t["done"]]
        _save(data)
    return redirect(url_for("index"))


# ---------- JSON API ----------

@app.get("/api/todos")
def api_list():
    return jsonify(_load()["todos"])


@app.post("/api/todos")
def api_create():
    body = request.get_json(silent=True) or {}
    return jsonify(add_todo(body.get("title"))), 201


@app.get("/api/todos/<int:todo_id>")
def api_get(todo_id):
    return jsonify(_find(_load(), todo_id))


@app.patch("/api/todos/<int:todo_id>")
def api_update(todo_id):
    body = request.get_json(silent=True) or {}
    changes = {k: body[k] for k in ("title", "done") if k in body}
    return jsonify(update_todo(todo_id, **changes))


@app.delete("/api/todos/<int:todo_id>")
def api_delete(todo_id):
    delete_todo(todo_id)
    return "", 204


@app.errorhandler(400)
@app.errorhandler(404)
def error(e):
    if request.path.startswith("/api/"):
        return jsonify(error=e.description), e.code
    return e
