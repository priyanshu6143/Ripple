package com.acme.identity.controller;

import com.acme.identity.service.UserService;
import com.acme.identity.service.NotificationService;

public class BillingWebhookController {
    private final UserService userService;
    private final NotificationService notificationService;

    public BillingWebhookController(UserService userService, NotificationService notificationService) {
        this.userService = userService;
        this.notificationService = notificationService;
    }

    public void onSubscriptionRenewed(String userId) {
        userService.getUserProfile(userId).ifPresent(user -> {
            notificationService.sendSecurityAlert(user, "SUBSCRIPTION_RENEWED");
        });
    }
}
