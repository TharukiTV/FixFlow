package com.fixflow.incident;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.*;
import com.fixflow.auth.AccountService;
import com.fixflow.ai.AnalysisController;
import org.springframework.web.client.RestClientException;
import java.net.URI;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentRepository incidents;
    private final AccountService accounts;
    private final AnalysisController analysisService;

    // Spring supplies the repository through constructor injection.
    public IncidentController(IncidentRepository incidents, AccountService accounts, AnalysisController analysisService) {
        this.incidents = incidents;
        this.accounts = accounts;
        this.analysisService = analysisService;
    }

    // Read the current role from PostgreSQL so role changes apply to existing sessions.
    private void requireRole(Principal principal, String role) {
        if (!accounts.profile(principal.getName()).role().equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role does not allow this action");
        }
    }

    public record Assignment(@NotBlank @Email @Size(max=254) String technicianEmail) {}

    @GetMapping("/technicians")
    public List<AccountService.Profile> technicians(Principal principal) {
        requireRole(principal, "ADMIN");
        return accounts.technicians();
    }

    @PatchMapping("/{id}/assignment")
    public Incident assign(@PathVariable long id, @Valid @RequestBody Assignment request, Principal principal) {
        requireRole(principal, "ADMIN");
        return incidents.assign(id, AccountService.normalize(request.technicianEmail())).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket or technician is unavailable"));
    }

    @GetMapping
    public List<Incident> list(Principal principal) {
        return incidents.findAll(principal.getName(), accounts.profile(principal.getName()).role());
    }

    @GetMapping("/{id}")
    public Incident get(@PathVariable long id, Principal principal) {
        return incidents.findById(id, principal.getName(), accounts.profile(principal.getName()).role()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
    }

    @GetMapping("/{id}/similar-fixes")
    public List<IncidentRepository.PastFix> similarFixes(@PathVariable long id, Principal principal) {
        requireRole(principal, "TECHNICIAN");
        incidents.findById(id, principal.getName(), "TECHNICIAN").orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
        return incidents.similarFixes(id, principal.getName());
    }

    @PostMapping
    public ResponseEntity<Incident> create(@Valid @RequestBody CreateIncidentRequest request, Principal principal, HttpSession session) {
        requireRole(principal, "USER");
        AnalysisController.Analysis analysis = null;
        try {
            analysis = analysisService.forSubmission(request, session);
        } catch (RestClientException | ResponseStatusException unavailable) {
            // Analysis is optional: persist the report even when the provider is unavailable.
        }
        Incident incident = incidents.create(request.description().strip(), request.location().strip(), principal.getName(), analysis);
        return ResponseEntity.created(URI.create("/api/incidents/" + incident.id())).body(incident);
    }

    @PatchMapping("/{id}/review")
    public Incident review(@PathVariable long id, @Valid @RequestBody ReviewRequest request, Principal principal) {
        requireRole(principal, "ADMIN");
        return incidents.review(id, request, principal.getName()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
    }

    @PatchMapping("/{id}/status")
    public Incident updateStatus(@PathVariable long id,
                                 @Valid @RequestBody UpdateIncidentStatusRequest request, Principal principal) {
        requireRole(principal, "TECHNICIAN");
        return incidents.updateStatus(id, request, principal.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
    }
}
