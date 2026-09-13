package com.fixflow.auth;

import java.util.Locale;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AccountService implements UserDetailsService {
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    public AccountService(JdbcClient jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc; this.encoder = encoder;
    }
    public record Profile(String email, String name, String role) {}
    public static String normalize(String email) { return email.strip().toLowerCase(Locale.ROOT); }
    @Override
    public UserDetails loadUserByUsername(String email) {
        return jdbc.sql("SELECT * FROM app_users WHERE email = :email")
            .param("email", normalize(email))
            .query((row, index) -> User.withUsername(row.getString("email"))
                .password(row.getString("password_hash")).roles(row.getString("role")).build())
            .optional().orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }
    public Profile profile(String email) {
        return jdbc.sql("SELECT email, name, role FROM app_users WHERE email = :email")
            .param("email", email).query((row, index) -> new Profile(row.getString("email"), row.getString("name"), row.getString("role"))).single();
    }
    public java.util.List<Profile> technicians() {
        return jdbc.sql("SELECT email, name, role FROM app_users WHERE role = 'TECHNICIAN' ORDER BY name, email")
            .query((row, index) -> new Profile(row.getString("email"), row.getString("name"), row.getString("role"))).list();
    }
    public void register(String email, String name, String password) {
        jdbc.sql("INSERT INTO app_users (email, name, password_hash) VALUES (:email, :name, :password)")
            .param("email", normalize(email)).param("name", name.strip())
            .param("password", encoder.encode(password)).update();
    }
}
