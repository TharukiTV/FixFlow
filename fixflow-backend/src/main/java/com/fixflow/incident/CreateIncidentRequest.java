package com.fixflow.incident;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateIncidentRequest(
        @NotBlank @Size(max = 2000) String description,
        @NotBlank @Size(max = 120) String location) {}
