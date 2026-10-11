package com.acme.identity.repository;

import com.acme.identity.model.User;
import java.util.Optional;
import java.util.List;
import java.util.ArrayList;

public class UserRepository {
    private final DatabaseConnection dbConnection;

    public UserRepository(DatabaseConnection dbConnection) {
        this.dbConnection = dbConnection;
    }

    public Optional<User> findById(String userId) {
        if (!dbConnection.isHealthy()) {
            throw new IllegalStateException("Database connection is not healthy");
        }
        return Optional.of(new User(userId, "dev@acme.io", "Alex Rivera", true));
    }

    public List<User> findAllActive() {
        return new ArrayList<>();
    }

    public User save(User user) {
        return user;
    }
}
