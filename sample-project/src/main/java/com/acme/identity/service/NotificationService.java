package com.acme.identity.service;

import com.acme.identity.model.User;

public class NotificationService {
    public void sendWelcomeEmail(User user) {
        System.out.println("Dispatching welcome email to " + user.getEmail());
    }

    public void sendSecurityAlert(User user, String action) {
        System.out.println("Security alert [" + action + "] sent to " + user.getEmail());
    }
}
