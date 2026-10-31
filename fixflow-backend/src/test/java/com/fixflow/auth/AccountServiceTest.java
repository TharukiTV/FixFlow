package com.fixflow.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

// Emails are normalized so "Admin@Example.com " and "admin@example.com" are the same account.
class AccountServiceTest {
    @Test
    void normalizeLowercasesAndTrimsEmail() {
        assertThat(AccountService.normalize("  Tech@Example.COM ")).isEqualTo("tech@example.com");
    }
}
