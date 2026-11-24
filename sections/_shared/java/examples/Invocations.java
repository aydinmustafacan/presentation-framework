import java.util.ArrayList;
import java.util.List;

public class Invocations {
    private int secret() { return 42; }

    void calls() {
        List<Integer> list = new ArrayList<>();
        list.add(secret());
        String s = list.toString();
        int n = Math.max(1, s.length());
        Runnable r = () -> System.out.println(n);
        r.run();
    }
}
