"""The /primes/200000 loop from app.py, timed on the host CPython for comparison."""
import sys, time
t = time.perf_counter()
n, count = 200000, 0
for k in range(2, n):
    d = 2
    while d * d <= k:
        if k % d == 0:
            break
        d += 1
    else:
        count += 1
ms = (time.perf_counter() - t) * 1000
print(f'{{"python": "{sys.version.split()[0]}", "primes": {count}, "ms": [{ms:.0f}]}}')
