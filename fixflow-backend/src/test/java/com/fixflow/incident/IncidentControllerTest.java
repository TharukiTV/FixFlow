package com.fixflow.incident;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fixflow.ai.AnalysisController;
import com.fixflow.auth.AccountService;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.server.ResponseStatusException;

// The database and AI service are replaced with Mockito mocks, so these tests run without PostgreSQL or Gemini.
class IncidentControllerTest {
    private IncidentRepository incidents;
    private AccountService accounts;
    private AnalysisController analysis;
    private IncidentController controller;

    @BeforeEach
    void setUp() {
        incidents = mock(IncidentRepository.class);
        accounts = mock(AccountService.class);
        analysis = mock(AnalysisController.class);
        controller = new IncidentController(incidents, accounts, analysis);
    }

    private Principal loggedInAs(String email, String role) {
        when(accounts.profile(email)).thenReturn(new AccountService.Profile(email, "Test", role));
        return () -> email;
    }

    private static Incident incident(long id, String status) {
        return new Incident(id, "Tap leaking", "Room 101", status, Instant.now(), "tech@example.com",
            null, null, null, null, null, null, null, null, null, "Worn washer", "Replaced washer", null);
    }

    @Test
    void ticketIsSavedEvenWhenAiServiceIsDown() {
        Principal user = loggedInAs("user@example.com", "USER");
        var request = new CreateIncidentRequest("Tap leaking", "Room 101");
        when(analysis.forSubmission(any(), any())).thenThrow(new ResourceAccessException("Python service offline"));
        when(incidents.create(anyString(), anyString(), anyString(), isNull())).thenReturn(incident(1, "OPEN"));

        var response = controller.create(request, user, new MockHttpSession());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(incidents).create("Tap leaking", "Room 101", "user@example.com", null);
    }

    @Test
    void ticketTextIsTrimmedBeforeSaving() {
        Principal user = loggedInAs("user@example.com", "USER");
        when(incidents.create(anyString(), anyString(), anyString(), any())).thenReturn(incident(1, "OPEN"));

        controller.create(new CreateIncidentRequest("  Tap leaking  ", " Room 101 "), user, new MockHttpSession());

        verify(incidents).create(eq("Tap leaking"), eq("Room 101"), eq("user@example.com"), any());
    }

    @Test
    void onlyUsersCanCreateTickets() {
        Principal admin = loggedInAs("admin@example.com", "ADMIN");

        assertThatThrownBy(() -> controller.create(new CreateIncidentRequest("Tap leaking", "Room 101"), admin, new MockHttpSession()))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("403");
        verify(incidents, never()).create(anyString(), anyString(), anyString(), any());
    }

    @Test
    void technicianCannotAssignTickets() {
        Principal technician = loggedInAs("tech@example.com", "TECHNICIAN");

        assertThatThrownBy(() -> controller.assign(1, new IncidentController.Assignment("other@example.com"), technician))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("403");
        verify(incidents, never()).assign(anyLong(), anyString());
    }

    @Test
    void adminAssignmentUsesNormalizedEmail() {
        Principal admin = loggedInAs("admin@example.com", "ADMIN");
        when(incidents.assign(1, "tech@example.com")).thenReturn(Optional.of(incident(1, "OPEN")));

        controller.assign(1, new IncidentController.Assignment(" Tech@Example.com "), admin);

        verify(incidents).assign(1, "tech@example.com");
    }

    @Test
    void missingTicketReturnsNotFound() {
        Principal user = loggedInAs("user@example.com", "USER");
        when(incidents.findById(99, "user@example.com", "USER")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.get(99, user))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("404");
    }

    @Test
    void geminiAnswerWithUnknownTicketIdFallsBackToTextMatches() {
        Principal technician = loggedInAs("tech@example.com", "TECHNICIAN");
        var pastFix = new IncidentRepository.PastFix(2, "Tap leaking", "Worn washer", "Replaced washer");
        when(incidents.findById(1, "tech@example.com", "TECHNICIAN")).thenReturn(Optional.of(incident(1, "OPEN")));
        when(incidents.findById(2, "tech@example.com", "TECHNICIAN")).thenReturn(Optional.of(incident(2, "RESOLVED")));
        when(incidents.similarFixes(1, "tech@example.com")).thenReturn(List.of(pastFix));
        when(incidents.recentFixes(1, "tech@example.com")).thenReturn(List.of());
        // Gemini "invents" ticket 999, which was never sent as a candidate.
        when(analysis.rankFixes(anyString(), any())).thenReturn(
            new AnalysisController.FixRanking(List.of(new AnalysisController.FixMatch(999, "Looks similar"))));

        var result = controller.rankFixes(1, technician);

        assertThat(result.mode()).isEqualTo("TEXT");
        assertThat(result.matches()).extracting(match -> match.fix().id()).containsExactly(2L);
    }
}
