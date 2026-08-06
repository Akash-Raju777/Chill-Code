# Build stage
FROM maven:3.8.8-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Run stage — includes compilers for local code execution fallback
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app

# Install GCC, G++, Python3 so local compilation fallback always works
# This is the PERMANENT fix for "GCC not found" on Render/Railway/Heroku
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

COPY --from=build /app/target/assessment-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
