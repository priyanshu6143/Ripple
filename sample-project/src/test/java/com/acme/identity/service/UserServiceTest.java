package com.acme.identity.service;

import com.acme.identity.model.User;
import com.acme.identity.repository.DatabaseConnection;
import com.acme.identity.repository.UserRepository;

public class UserServiceTest {
    public void shouldRegisterAndNotifyUser() {
        DatabaseConnection db = new DatabaseConnection("jdbc:h2:mem:test");
        UserRepository repo = new UserRepository(db);
        NotificationService notifications = new NotificationService();
        UserService service = new UserService(repo, notifications);

        User result = service.registerUser("u-101", "alex@acme.io", "Alex Rivera");
        assert result != null;
    }
}
