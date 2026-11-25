import jep.*;
// numpy inside an isolated JEP sub-interpreter (own GIL). Run: ./isolated-numpy.sh  -> results/isolated-numpy.txt
public class IsolatedNumpy { public static void main(String[] a) throws Exception {
  String site=System.getProperty("site"); MainInterpreter.setJepLibraryPath(site+"/jep/libjep.jnilib");
  if (a.length>0) { SharedInterpreter.setConfig(new JepConfig().addIncludePaths(site)); SharedInterpreter sh=new SharedInterpreter(); sh.exec("import numpy"); System.out.println("shared: numpy ok"); }
  Thread t = new Thread(() -> {
    try (SubInterpreter p = new SubInterpreter(new JepConfig().addIncludePaths(site).setSubInterpreterOptions(SubInterpreterOptions.isolated()))) {
      p.exec("import numpy; r = int(numpy.arange(5).sum())"); System.out.println("isolated sub: numpy ok " + p.getValue("r"));
    } catch (Exception e) { System.out.println("isolated sub: " + e.getMessage()); }
  });
  t.start(); t.join(); System.exit(0);
}}
