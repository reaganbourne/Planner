package com.reagan.planner.common;

import com.reagan.planner.user.User;
import com.reagan.planner.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataLoader(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            User user = new User();
            user.setEmail("reagan@example.com");
            user.setPasswordHash(passwordEncoder.encode("password123"));
            userRepository.save(user);
        }
    }
}
