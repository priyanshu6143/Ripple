package com.acme.identity.service;

import com.acme.identity.model.User;
import com.acme.identity.repository.UserRepository;

public class AuditService {
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public AuditService(UserRepository userRepository, NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public void recordRoleChange(String userId, String newRole) {
        userRepository.findById(userId).ifPresent(user -> {
            notificationService.sendSecurityAlert(user, "ROLE_UPDATED:" + newRole);
        });
    }
}
