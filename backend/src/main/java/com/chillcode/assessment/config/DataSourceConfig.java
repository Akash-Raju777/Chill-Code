package com.chillcode.assessment.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    private static final String DEFAULT_POOLER_HOST = "aws-1-ap-southeast-2.pooler.supabase.com";
    private static final int DEFAULT_TX_PORT = 6543;
    private static final int DEFAULT_SESSION_PORT = 5432;

    @Value("${spring.datasource.url:}")
    private String propUrl;

    @Value("${spring.datasource.username:postgres.kuvllswyxrtjjbougrgy}")
    private String propUsername;

    @Value("${spring.datasource.password:AkashAkASh@777}")
    private String propPassword;

    @Value("${spring.datasource.driver-class-name:org.postgresql.Driver}")
    private String driverClassName;

    @Bean
    @Primary
    public DataSource dataSource() {
        System.out.println("==========================================================");
        System.out.println("  [DataSourceConfig] INITIALIZING DATABASE CONNECTION");
        System.out.println("==========================================================");

        // 1. Resolve raw URL from env or properties
        String rawUrl = System.getenv("DB_URL");
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = System.getenv("DATABASE_URL");
        }
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = System.getenv("SPRING_DATASOURCE_URL");
        }
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = propUrl;
        }

        // 2. Parse and normalize
        DbCredentials credentials = parseCredentialsAndUrl(rawUrl, propUsername, propPassword);

        // For H2 in tests
        if (credentials.jdbcUrl.startsWith("jdbc:h2:")) {
            log.info("[DataSourceConfig] Using H2 in-memory database");
            HikariConfig h2Config = new HikariConfig();
            h2Config.setJdbcUrl(credentials.jdbcUrl);
            h2Config.setUsername(credentials.username);
            h2Config.setPassword(credentials.password);
            h2Config.setDriverClassName(driverClassName);
            return new HikariDataSource(h2Config);
        }

        System.out.println("[DataSourceConfig] Primary Target: " + maskUrl(credentials.jdbcUrl));
        System.out.println("[DataSourceConfig] Username: " + credentials.username);

        // 3. Try primary connection
        HikariDataSource primaryDs = createHikariDataSource(credentials.jdbcUrl, credentials.username, credentials.password);
        try (Connection conn = primaryDs.getConnection()) {
            System.out.println("[DataSourceConfig] SUCCESS: Connected to primary database URL!");
            System.out.println("==========================================================");
            return primaryDs;
        } catch (Exception primaryEx) {
            System.err.println("[DataSourceConfig] Primary connection attempt failed: " + primaryEx.getMessage());
            primaryDs.close();

            // 4. Try fallback port (6543 <-> 5432)
            String fallbackUrl = getAlternativePortUrl(credentials.jdbcUrl);
            if (fallbackUrl != null && !fallbackUrl.equals(credentials.jdbcUrl)) {
                System.out.println("[DataSourceConfig] Attempting fallback to: " + maskUrl(fallbackUrl));
                HikariDataSource fallbackDs = createHikariDataSource(fallbackUrl, credentials.username, credentials.password);
                try (Connection conn = fallbackDs.getConnection()) {
                    System.out.println("[DataSourceConfig] SUCCESS: Connected via fallback database URL!");
                    System.out.println("==========================================================");
                    return fallbackDs;
                } catch (Exception fallbackEx) {
                    System.err.println("[DataSourceConfig] Fallback connection also failed: " + fallbackEx.getMessage());
                    fallbackDs.close();
                }
            }

            // If both failed, log full diagnostic stack trace for debugging
            System.err.println("==========================================================");
            System.err.println("  [DataSourceConfig] CRITICAL DATABASE CONNECTION ERROR");
            System.err.println("==========================================================");
            primaryEx.printStackTrace();
            System.err.println("==========================================================");

            // Recreate primary so Spring Boot can report the standard error if required
            return createHikariDataSource(credentials.jdbcUrl, credentials.username, credentials.password);
        }
    }

    private HikariDataSource createHikariDataSource(String jdbcUrl, String username, String password) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName(driverClassName);

        config.setConnectionTimeout(30000);
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        config.setIdleTimeout(30000);
        config.setMaxLifetime(60000);
        config.setKeepaliveTime(30000);
        config.setValidationTimeout(5000);
        config.setConnectionTestQuery("SELECT 1");
        config.setTransactionIsolation("TRANSACTION_READ_COMMITTED");

        return new HikariDataSource(config);
    }

    private String getAlternativePortUrl(String url) {
        if (url.contains(":5432")) {
            return url.replace(":5432", ":" + DEFAULT_TX_PORT);
        } else if (url.contains(":6543")) {
            return url.replace(":6543", ":" + DEFAULT_SESSION_PORT);
        }
        return null;
    }

    private DbCredentials parseCredentialsAndUrl(String rawUrl, String defaultUser, String defaultPass) {
        String url = (rawUrl != null) ? rawUrl.trim() : "";
        if (url.startsWith("\"") && url.endsWith("\"") && url.length() > 1) {
            url = url.substring(1, url.length() - 1);
        }
        if (url.startsWith("'") && url.endsWith("'") && url.length() > 1) {
            url = url.substring(1, url.length() - 1);
        }

        String username = System.getenv("DB_USERNAME");
        if (username == null || username.isBlank()) {
            username = defaultUser;
        }

        String password = System.getenv("DB_PASSWORD");
        if (password == null || password.isBlank()) {
            password = defaultPass;
        }

        if (url.isEmpty()) {
            url = "jdbc:postgresql://" + DEFAULT_POOLER_HOST + ":" + DEFAULT_TX_PORT + "/postgres?sslmode=require&prepareThreshold=0&tcpKeepAlive=true";
            return new DbCredentials(url, username, password);
        }

        // Check if raw URL contains credentials: postgresql://user:pass@host:port/dbname
        // Pattern: (postgres(?:ql)?:\/\/)([^:@]+)(?::([^@]+))?@(.+)
        Pattern uriPattern = Pattern.compile("^(?:jdbc:)?postgres(?:ql)?://([^:@]+)(?::([^@]+))?@(.+)$");
        Matcher matcher = uriPattern.matcher(url);
        if (matcher.matches()) {
            String extractedUser = matcher.group(1);
            String extractedPass = matcher.group(2);
            String hostAndRest = matcher.group(3);

            if (extractedUser != null && !extractedUser.isBlank()) {
                username = extractedUser;
            }
            if (extractedPass != null && !extractedPass.isBlank()) {
                password = extractedPass;
            }

            url = "jdbc:postgresql://" + hostAndRest;
        }

        // Ensure jdbc: prefix
        if (url.startsWith("postgres://")) {
            url = "jdbc:postgresql://" + url.substring("postgres://".length());
        } else if (url.startsWith("postgresql://")) {
            url = "jdbc:postgresql://" + url.substring("postgresql://".length());
        } else if (!url.startsWith("jdbc:postgresql:") && !url.startsWith("jdbc:h2:")) {
            url = "jdbc:postgresql://" + url;
        }

        // Replace IPv6-only direct Supabase host with IPv4 pooler
        if (url.contains("db.kuvllswyxrtjjbougrgy.supabase.co")) {
            url = url.replace("db.kuvllswyxrtjjbougrgy.supabase.co", DEFAULT_POOLER_HOST);
        }

        // Ensure required parameters
        if (!url.contains("sslmode=")) {
            url += (url.contains("?") ? "&" : "?") + "sslmode=require";
        }
        if (!url.contains("prepareThreshold=")) {
            url += "&prepareThreshold=0";
        }
        if (!url.contains("tcpKeepAlive=")) {
            url += "&tcpKeepAlive=true";
        }

        return new DbCredentials(url, username, password);
    }

    private String maskUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll(":[^/@:]+@", ":****@");
    }

    private static class DbCredentials {
        final String jdbcUrl;
        final String username;
        final String password;

        DbCredentials(String jdbcUrl, String username, String password) {
            this.jdbcUrl = jdbcUrl;
            this.username = username;
            this.password = password;
        }
    }
}
