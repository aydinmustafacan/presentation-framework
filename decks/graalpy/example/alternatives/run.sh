#!/usr/bin/env bash
# Usage: ./run.sh jython|jep|graalpy [label]   -> results/<label>.json (label defaults to the runtime name; see README.md)
set -e
cd "$(dirname "$0")"
JAVA=${JAVA:-java}; JAVAC=${JAVAC:-javac}
JYTHON_JAR=${JYTHON_JAR:-$HOME/.m2/repository/org/python/jython-standalone/2.7.4/jython-standalone-2.7.4.jar}
SITE=$(cd .venv/lib/python3*/site-packages && pwd)
GRAALPY_JAR=../flask-jar/target/flask-jar-1.0.jar
mkdir -p out
case "$1" in
  jython)  CP="$JYTHON_JAR"; MAIN=JythonRun ;;
  jep)     CP="$SITE/jep/jep-4.4.0.jar"; MAIN=JepRun ;;
  graalpy) CP="$GRAALPY_JAR"; MAIN=GraalPyRun ;;
  *) echo "usage: $0 jython|jep|graalpy"; exit 1 ;;
esac
"$JAVAC" -nowarn -d out -cp "$CP" Common.java $MAIN.java
mkdir -p results
OUT=results/${2:-$1}.json
"$JAVA" --enable-native-access=ALL-UNNAMED -Dsite="$SITE" -cp "out:$CP" $MAIN > "$OUT"
cat "$OUT"
