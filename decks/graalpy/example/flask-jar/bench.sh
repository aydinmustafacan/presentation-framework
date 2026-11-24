#!/usr/bin/env bash
# Usage: ./bench.sh [java-binary] [label] [port]
# Starts the fat JAR, records time-to-first-response, then times 40 identical CPU-bound requests.
JAVA=${1:-java}; LABEL=${2:-run}; PORT=${3:-8765}
now() { python3 -c 'import time;print(time.time())'; }
T0=$(now)
"$JAVA" -jar target/flask-jar-1.0.jar $PORT > "bench-$LABEL.log" 2>&1 &
PID=$!
until curl -s -o /dev/null localhost:$PORT/; do sleep 0.1; done
T1=$(now)
echo "ready_ms=$(python3 -c "print(round(($T1-$T0)*1000))")"
grep "imported in" "bench-$LABEL.log"
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{time_total}\n" localhost:$PORT/primes/200000; done > "bench-$LABEL.txt"
kill $PID
