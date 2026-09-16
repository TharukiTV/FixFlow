package com.fixflow.ai;

import com.fixflow.incident.CreateIncidentRequest;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {
    private final RestClient client;
    public record Analysis(String mode, String category, String priority, String summary, String notice) {}

    public AnalysisController(@Value("${fixflow.ai.url}") String url) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(25));
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    public record FixMatch(long id, String explanation) {}
    public record FixRanking(java.util.List<FixMatch> matches) {}
    public FixRanking rankFixes(String description, java.util.List<com.fixflow.incident.IncidentRepository.PastFix> candidates) {
        return client.post().uri("/ai/similar-fixes")
            .body(Map.of("description", description, "candidates", candidates))
            .retrieve().body(FixRanking.class);
    }

    private static final String CACHE_KEY = AnalysisController.class.getName() + ".previews";
    private record Input(String description, String location) {
        static Input from(CreateIncidentRequest request) {
            return new Input(request.description().strip(), request.location().strip());
        }
    }
    private record Preview(Analysis analysis, long expiresAt) {}

    @SuppressWarnings("unchecked")
    private LinkedHashMap<Input, Preview> previews(HttpSession session) {
        var cache = (LinkedHashMap<Input, Preview>) session.getAttribute(CACHE_KEY);
        if (cache == null) {
            cache = new LinkedHashMap<>();
            session.setAttribute(CACHE_KEY, cache);
        }
        return cache;
    }

    @PostMapping
    public Analysis preview(@Valid @RequestBody CreateIncidentRequest request, HttpSession session) {
        Analysis result = analyze(request);
        synchronized (session) {
            var cache = previews(session);
            cache.entrySet().removeIf(entry -> entry.getValue().expiresAt() < System.nanoTime());
            cache.remove(Input.from(request));
            cache.put(Input.from(request), new Preview(result, System.nanoTime() + Duration.ofMinutes(10).toNanos()));
            while (cache.size() > 8) cache.remove(cache.keySet().iterator().next());
        }
        return result;
    }

    public Analysis forSubmission(CreateIncidentRequest request, HttpSession session) {
        synchronized (session) {
            Preview cached = previews(session).get(Input.from(request));
            if (cached != null && cached.expiresAt() >= System.nanoTime()) return cached.analysis();
        }
        return analyze(request);
    }

    public Analysis analyze(CreateIncidentRequest request) {
        // Authentication and CSRF are enforced by Spring Security, as for other API writes.
        try {
            Analysis result = client.post().uri("/ai/analyze-incident").body(request)
                .retrieve().body(Analysis.class);
            if (result == null || !("DEMO".equals(result.mode()) || "GEMINI".equals(result.mode())) || result.category() == null
                    || result.priority() == null || result.summary() == null || result.notice() == null
                    || !Set.of("IT", "PLUMBING", "ELECTRICAL", "FURNITURE", "SAFETY", "GENERAL").contains(result.category())
                    || !Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL", "UNASSESSED").contains(result.priority())
                    || result.summary().isBlank() || result.summary().length() > 1000) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid analysis response");
            }
            return result;
        } catch (RestClientResponseException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI analysis is unavailable. You can still submit your ticket.");
        }
    }
    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<Map<String, String>> providerFailure(RestClientResponseException exception) {
        String code = exception.getResponseHeaders() == null ? "" : exception.getResponseHeaders().getFirst("X-Analysis-Error");
        String detail = switch (code == null ? "" : code) {
            case "QUOTA_LIMIT" -> "Gemini quota or rate limit reached. Try later; you can still submit your ticket.";
            case "PROVIDER_ERROR" -> "Google Gemini returned a server error. Try again later; you can still submit your ticket.";
            case "TIMEOUT" -> "Gemini took too long to respond. Try later; you can still submit your ticket.";
            case "NETWORK_ERROR" -> "Cannot connect to Google Gemini. Check your internet connection or proxy; you can still submit your ticket.";
            case "INVALID_KEY" -> "Google rejected the API key. Re-copy your Gemini key and restart Python.";
            case "ACCESS_DENIED" -> "Google denied access. Check your Gemini key restrictions and API access.";
            case "MODEL_UNAVAILABLE" -> "The configured Gemini model is unavailable. Check GEMINI_MODEL in the Python service.";
            case "REQUEST_REJECTED" -> "Google rejected the request configuration (HTTP 400). Check the Gemini model and API settings.";
            default -> "AI analysis is unavailable. You can still submit your ticket.";
        };
        return ResponseEntity.status(503).body(Map.of("detail", detail));
    }

}
