import io
import zipfile
from typing import Dict

SAMPLE_PROJECT_NAME = "acme-identity-service.zip"

SAMPLE_FILES: Dict[str, str] = {
    "src/main/java/com/acme/identity/model/User.java": """package com.acme.identity.model;

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
""",
    "src/main/java/com/acme/identity/repository/DatabaseConnection.java": """package com.acme.identity.repository;

public class DatabaseConnection {
    private final String jdbcUrl;

    public DatabaseConnection(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
    }

    public boolean isHealthy() {
        return jdbcUrl != null && !jdbcUrl.isEmpty();
    }
}
""",
    "src/main/java/com/acme/identity/repository/UserRepository.java": """package com.acme.identity.repository;

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
""",
    "src/main/java/com/acme/identity/service/NotificationService.java": """package com.acme.identity.service;

import com.acme.identity.model.User;

public class NotificationService {
    public void sendWelcomeEmail(User user) {
        System.out.println("Dispatching welcome email to " + user.getEmail());
    }

    public void sendSecurityAlert(User user, String action) {
        System.out.println("Security alert [" + action + "] sent to " + user.getEmail());
    }
}
""",
    "src/main/java/com/acme/identity/service/AuditService.java": """package com.acme.identity.service;

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
""",
    "src/main/java/com/acme/identity/service/UserService.java": """package com.acme.identity.service;

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
""",
    "src/main/java/com/acme/identity/controller/UserController.java": """package com.acme.identity.controller;

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
""",
    "src/main/java/com/acme/identity/controller/BillingWebhookController.java": """package com.acme.identity.controller;

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
""",
    "src/test/java/com/acme/identity/service/UserServiceTest.java": """package com.acme.identity.service;

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
""",
    "src/test/java/com/acme/identity/controller/UserControllerTest.java": """package com.acme.identity.controller;

import com.acme.identity.service.UserService;
import com.acme.identity.service.AuditService;

public class UserControllerTest {
    public void shouldDelegateUserCreationToService() {
        // Verifies UserController endpoint delegation
    }
}
""",
    "web-portal/src/api/httpClient.ts": """export interface ApiResponse<T> {
  data: T;
  status: number;
}

export async function requestJson<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(path);
  const data = (await response.json()) as T;
  return { data, status: response.status };
}
""",
    "web-portal/src/services/userApi.ts": """import { requestJson } from '../api/httpClient';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
}

export async function fetchUserProfile(userId: string) {
  return requestJson<UserDto>(`/api/users/${userId}`);
}
""",
    "web-portal/src/components/UserProfileCard.tsx": """import { fetchUserProfile, UserDto } from '../services/userApi';

export async function loadProfileViewModel(userId: string): Promise<UserDto> {
  const res = await fetchUserProfile(userId);
  return res.data;
}
""",
    "web-portal/src/services/userApi.test.ts": """import { fetchUserProfile } from './userApi';

export async function testFetchUserProfile() {
  const response = await fetchUserProfile('u-101');
  return response.status === 200;
}
""",
    "node_modules/ignored-package/index.js": """// Should be ignored automatically by Ripple static analyzer
module.exports = {};
""",
}


def build_sample_zip_bytes() -> bytes:
    """Create an in-memory ZIP file containing the sample project."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_path, content in SAMPLE_FILES.items():
            zf.writestr(file_path, content.strip() + "\n")
    return buffer.getvalue()
