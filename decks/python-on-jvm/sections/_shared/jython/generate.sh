#!/usr/bin/env bash
# Compiles add.py with Jython and Add.java with javac, then writes trimmed `javap -c` of each `add` method.
# Usage: ./generate.sh [path/to/jython-standalone.jar]   (default: Jython 2.7.4 from ~/.m2)
set -euo pipefail
cd "$(dirname "$0")"
JAR=${1:-$HOME/.m2/repository/org/python/jython-standalone/2.7.4/jython-standalone-2.7.4.jar}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp add.py Add.java "$T"
(cd "$T" && java -jar "$JAR" -c "import add" >/dev/null 2>&1 && javac --release 21 Add.java)
# keep one method's Code block, drop constant-pool numbers, package prefixes and type descriptors
clean() { sed -E -e 's/#[0-9]+ +\/\/ (Method|Field) //' -e 's#org/python/core/##g' -e 's/:\(.*$//' -e 's/:I$//' -e 's/^ +//' -e 's/  +/ /g'; }
javap -c "$T/add\$py.class" | sed -n '/PyObject add\$1(/,/^$/p' | sed '1,2d;/^$/d' | clean > python.javap.txt
javap -c "$T/Add.class"     | sed -n '/static int add(/,/^$/p'   | sed '1,2d;/^$/d;/^}/d' | clean > java.javap.txt
