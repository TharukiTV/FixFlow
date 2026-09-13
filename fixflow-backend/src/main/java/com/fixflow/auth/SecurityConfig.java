package com.fixflow.auth;

import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() { return PasswordEncoderFactories.createDelegatingPasswordEncoder(); }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http
            .csrf(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers("/api/auth/csrf", "/api/auth/register", "/api/auth/login", "/", "/index.html").permitAll()
                .anyRequest().authenticated())
            .requestCache(cache -> cache.disable())
            .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, exception) -> response.setStatus(401)))
            .formLogin(login -> login.loginProcessingUrl("/api/auth/login")
                .successHandler((request, response, authentication) -> response.setStatus(204))
                .failureHandler((request, response, exception) -> response.setStatus(401)))
            .logout(logout -> logout.logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
            .build();
    }
}
