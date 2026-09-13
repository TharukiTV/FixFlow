package com.fixflow.incident;

import jakarta.validation.constraints.*;

public record UpdateIncidentStatusRequest(@NotNull IncidentStatus status,
        @Size(max=1000) String cause, @Size(max=2000) String resolution) {
    @AssertTrue(message="Cause and resolution notes are required when resolving a ticket")
    public boolean isResolutionComplete() {
        return status != IncidentStatus.RESOLVED ||
            (cause != null && !cause.isBlank() && resolution != null && !resolution.isBlank());
    }
}
