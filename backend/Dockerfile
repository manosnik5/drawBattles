FROM eclipse-temurin:21-jdk

WORKDIR /app

COPY . .

RUN chmod +x mvnw && ./mvnw clean package -DskipTests

EXPOSE 5000

CMD ["java", "-jar", "target/drawroyale-0.0.1-SNAPSHOT.jar"]