package com.acme.identity.service;

import com.acme.identity.model.User;
import com.acme.identity.repository.UserRepository;
import java.util.Optional;

public class UserService {
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public UserService(UserRepository userRepository, NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public User registerUser(String id, String email, String fullName) {
        User created = new User(id, email, fullName, true);
        User persisted = userRepository.save(created);
        notificationService.sendWelcomeEmail(persisted);
        return persisted;
    }

    public Optional<User> getUserProfile(String userId) {
        return userRepository.findById(userId);
    }
}
