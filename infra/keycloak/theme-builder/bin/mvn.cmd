@echo off
REM Apache Maven, in a container. See the `mvn` script beside this one for why.
REM Windows needs its own entry point: Node looks for mvn.cmd, not a shell script.
docker run --rm -v "%CD%:/workdir" -v cpeople-maven-cache:/root/.m2 -w /workdir maven:3.9-eclipse-temurin-21 mvn %*
