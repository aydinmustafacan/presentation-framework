public class Sim {
    static int arith(int a, int b, int c) {
        return (a + b) * c;
    }

    static int sum(int n) {
        int s = 0;
        for (int i = 1; i <= n; i++) {
            s += i;
        }
        return s;
    }

    static int gcd(int a, int b) {
        while (b != 0) {
            int t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    static int fact(int n) {
        if (n <= 1) return 1;
        return n * fact(n - 1);
    }

    static int max(int a, int b) {
        return a > b ? a : b;
    }
}
