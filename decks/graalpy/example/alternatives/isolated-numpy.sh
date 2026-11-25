#!/usr/bin/env bash
# numpy in an isolated JEP sub-interpreter, with and without numpy already loaded in the main interpreter.
cd "$(dirname "$0")"
SITE=$(cd .venv/lib/python3*/site-packages && pwd); CP="$SITE/jep/jep-4.4.0.jar"
mkdir -p out results; javac -d out -cp "$CP" IsolatedNumpy.java
{
  echo "== numpy only in the isolated sub-interpreter"
  java --enable-native-access=ALL-UNNAMED -Dsite="$SITE" -cp "out:$CP" IsolatedNumpy 2>&1 | grep -v '^\s*at '; echo "exit=${PIPESTATUS[0]}"
  echo "== numpy first imported by a SharedInterpreter"
  java --enable-native-access=ALL-UNNAMED -Dsite="$SITE" -cp "out:$CP" IsolatedNumpy first 2>&1 | grep -v '^\s*at '; echo "exit=${PIPESTATUS[0]}"
} > results/isolated-numpy.txt
cat results/isolated-numpy.txt
