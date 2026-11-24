public class Switches {
    static String dense(int day) {
        switch (day) {
            case 1: return "Mon";
            case 2: return "Tue";
            case 3: return "Wed";
            case 4: return "Thu";
            default: return "?";
        }
    }

    static int sparse(int code) {
        switch (code) {
            case 200: return 0;
            case 404: return 1;
            case 5000: return 2;
            default: return -1;
        }
    }
}
