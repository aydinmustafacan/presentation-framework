# Shared by all three harnesses. Must stay valid Python 2.7 (Jython) and 3.x (JEP = CPython, GraalPy).
import sys

def primes(n):
    # the same loop as /primes/<n> in flask-jar's app.py
    count = 0
    for k in range(2, n):
        d = 2
        while d * d <= k:
            if k % d == 0:
                break
            d += 1
        else:
            count += 1
    return count

def probe(m, b, s):
    # what does Python see when Java passes a HashMap, a byte[] and a String?
    return (type(m).__name__, type(b).__name__, type(s).__name__,
            sorted([str(k) for k in m.keySet()]), len(b), s.upper())

FSTRING = "x = 41\ny = f'{x + 1}'"
NUMPY = "import numpy\nr = int(numpy.arange(1000).sum())"
