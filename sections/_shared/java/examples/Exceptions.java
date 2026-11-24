public class Exceptions {
    static int parse(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return -1;
        } finally {
            System.out.println("done");
        }
    }
}
