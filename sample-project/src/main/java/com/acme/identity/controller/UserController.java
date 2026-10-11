package com.acme.identity.controller;

import com.acme.identity.model.User;
import com.acme.identity.service.UserService;
import com.acme.identity.service.AuditService;
import java.util.Optional;

public class UserController {
    private final UserService userService;
    private final AuditService auditService;

    public UserController(UserService userService, AuditService auditService) {
        this.userService = userService;
        this.auditService = auditService;
    }

    public User handleCreateUser(String id, String email, String name) {
        return userService.registerUser(id, email, name);
    }

    public Optional<User> handleGetUser(String id) {
        return userService.getUserProfile(id);
    }

    public void handlePromoteAdmin(String id) {
        auditService.recordRoleChange(id, "ADMIN");
    }
}
