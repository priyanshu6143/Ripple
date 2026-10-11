package com.acme.identity.repository;

public class DatabaseConnection {
    private final String jdbcUrl;

    public DatabaseConnection(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
    }

    public boolean isHealthy() {
        return jdbcUrl != null && !jdbcUrl.isEmpty();
    }
}
