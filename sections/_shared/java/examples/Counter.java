public class Counter {
    private int count;

    void increment() {
        count++;
    }

    static Counter create() {
        Counter o = new Counter();
        o.increment();
        return o;
    }
}
