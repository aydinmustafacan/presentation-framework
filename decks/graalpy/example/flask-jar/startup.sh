#!/usr/bin/env bash
# Usage: ./startup.sh <java-binary> <label> [runs]
# Time from `java -jar` to the first HTTP 200 on GET /, several cold starts; appends ms to startup-<label>.txt
JAVA=${1:-java}; LABEL=${2:-run}; RUNS=${3:-3}; PORT=8790
now() { python3 -c 'import time;print(time.time())'; }
: > "startup-$LABEL.txt"
for r in $(seq 1 $RUNS); do
  T0=$(now)
  "$JAVA" -jar target/flask-jar-1.0.jar $PORT > /dev/null 2>&1 &
  PID=$!
  until curl -s -o /dev/null localhost:$PORT/; do sleep 0.05; done
  T1=$(now)
  python3 -c "print(round(($T1-$T0)*1000))" >> "startup-$LABEL.txt"
  kill $PID; wait $PID 2>/dev/null
done
cat "startup-$LABEL.txt" | tr '\n' ' '; echo
