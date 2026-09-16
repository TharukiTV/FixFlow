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

    public record RankedFix(IncidentRepository.PastFix fix, String explanation) {}
    public record SimilarResult(String mode, String notice, List<RankedFix> matches) {}

    @PostMapping("/{id}/similar-fixes")
    public SimilarResult rankFixes(@PathVariable long id, Principal principal) {
        requireRole(principal, "TECHNICIAN");
        Incident source = get(id, principal);
        var text = incidents.similarFixes(id, principal.getName());
        var candidates = new java.util.LinkedHashMap<Long, IncidentRepository.PastFix>();
        text.forEach(fix -> candidates.put(fix.id(), fix));
        incidents.recentFixes(id, principal.getName()).forEach(fix -> candidates.putIfAbsent(fix.id(), fix));
        SimilarResult result = new SimilarResult("TEXT", "Gemini unavailable. Showing text matches.",
            text.stream().map(fix -> new RankedFix(fix, null)).toList());
        if (candidates.isEmpty()) return new SimilarResult("TEXT", "No eligible past records to compare.", List.of());
        try {
            var ranking = analysisService.rankFixes(source.description(), List.copyOf(candidates.values()));
            if (ranking == null || ranking.matches() == null || ranking.matches().size() > 5)
                throw new IllegalArgumentException("Invalid ranking");
            var seen = new java.util.HashSet<Long>();
            var matches = new java.util.ArrayList<RankedFix>();
            for (var match : ranking.matches()) {
                if (match == null || !candidates.containsKey(match.id()) || !seen.add(match.id())
                    || match.explanation() == null || match.explanation().isBlank() || match.explanation().length() > 500)
                    throw new IllegalArgumentException("Invalid match");
                matches.add(new RankedFix(candidates.get(match.id()), match.explanation()));
            }
            result = new SimilarResult("GEMINI", "Gemini relevance suggestions. Similarity does not establish the same cause.", matches);
        } catch (org.springframework.web.client.RestClientResponseException unavailable) {
            String code = unavailable.getResponseHeaders() == null ? null
                : unavailable.getResponseHeaders().getFirst("X-Analysis-Error");
            String reason = switch (code == null ? "" : code) {
                case "PROVIDER_ERROR" -> "Google Gemini returned a server error. Try again later.";
                case "QUOTA_LIMIT" -> "Gemini quota or rate limit reached. Try again after your quota resets.";
                case "TIMEOUT" -> "Gemini took too long to respond.";
                case "NETWORK_ERROR" -> "The Python service could not connect to Google Gemini.";
                case "INVALID_KEY" -> "Google rejected the Gemini API key. Check the key in the Python terminal.";
                case "ACCESS_DENIED" -> "Google denied access to Gemini. Check the key restrictions.";
                case "MODEL_UNAVAILABLE" -> "The configured Gemini model is unavailable.";
                case "REQUEST_REJECTED" -> "Google rejected the Gemini request configuration.";
                default -> unavailable.getStatusCode().value() == 404
                    ? "Restart the Python service to load the comparison endpoint."
                    : "The AI service could not return a valid comparison.";
            };
            result = new SimilarResult("TEXT", reason + " Showing text matches instead.", result.matches());
        } catch (RestClientException unavailable) {
            result = new SimilarResult("TEXT", "The AI service could not be reached or timed out. Check the Python terminal. Showing text matches instead.", result.matches());
        } catch (IllegalArgumentException invalid) {
            result = new SimilarResult("TEXT", "Gemini returned an invalid comparison. Showing text matches instead.", result.matches());
        }
        // Recheck access after the external request, which may take several seconds.
        requireRole(principal, "TECHNICIAN");
        get(id, principal);
        var accessible = result.matches().stream().filter(match ->
            incidents.findById(match.fix().id(), principal.getName(), "TECHNICIAN")
                .filter(current -> "RESOLVED".equals(current.status())
                    && java.util.Objects.equals(current.description(), match.fix().description())
                    && java.util.Objects.equals(current.cause(), match.fix().cause())
                    && java.util.Objects.equals(current.resolution(), match.fix().resolution())).isPresent()).toList();
        return new SimilarResult(result.mode(), result.notice(), accessible);
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
