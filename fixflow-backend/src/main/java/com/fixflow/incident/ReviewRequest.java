package com.fixflow.incident;

import jakarta.validation.constraints.*;

public record ReviewRequest(@NotNull Category category, @NotNull Priority priority,
                            @NotBlank @Size(max=1000) String summary) {
    public enum Category { IT, PLUMBING, ELECTRICAL, FURNITURE, SAFETY, GENERAL }
    public enum Priority { LOW, MEDIUM, HIGH, CRITICAL, UNASSESSED }
}
