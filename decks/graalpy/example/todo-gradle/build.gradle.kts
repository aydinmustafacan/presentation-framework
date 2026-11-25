plugins {
    java
    // pip-installs the packages at build time into the JAR's resources (the virtual filesystem);
    // also adds the GraalPy runtime + python-embedding (GraalPyResources) as dependencies.
    id("org.graalvm.python") version "25.0.5"
    // one runnable fat JAR: our main + GraalPy + Truffle + the Python packages
    id("com.gradleup.shadow") version "9.2.2"
}

group = "demo"
version = "1.0"

repositories { mavenCentral() }

tasks.withType<JavaCompile> { options.release = 21 }

graalPy {
    packages = setOf("flask==3.1.3")
}

tasks.shadowJar {
    archiveClassifier = ""
    // Truffle finds its languages (python, regex, nfi...) via META-INF/services: merge them, don't keep one.
    // Shadow 9 drops duplicates before transformers run unless INCLUDE is set.
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
    mergeServiceFiles()
    // GraalPy's "python" / "python-community" are POM-only aggregators: keep their JARs, skip the .pom itself
    dependencies {
        exclude(dependency("org.graalvm.python:python:.*"))
        exclude(dependency("org.graalvm.polyglot:python-community:.*"))
    }
    manifest { attributes("Main-Class" to "demo.Main", "Multi-Release" to "true") }
    exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA")
}
tasks.build { dependsOn(tasks.shadowJar) }
