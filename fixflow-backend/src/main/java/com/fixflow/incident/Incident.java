package com.fixflow.incident;

import java.time.Instant;

// A record is a concise Java class for holding data.
public record Incident(long id, String description, String location,
                       String status, Instant createdAt, String assignedTechnician,
                       String aiMode, String aiCategory, String aiPriority, String aiSummary,
                       String reviewedCategory, String reviewedPriority, String reviewedSummary,
                       String reviewedBy, Instant reviewedAt, String cause, String resolution, Instant resolvedAt) {}
