package com.acme.identity.model;

import java.time.Instant;

public class User {
    private final String id;
    private final String email;
    private final String fullName;
    private final boolean active;
    private final Instant createdAt;

    public User(String id, String email, String fullName, boolean active) {
        this.id = id;
        this.email = email;
        this.fullName = fullName;
        this.active = active;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public String getEmail() { return email; }
    public String getFullName() { return fullName; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
}
