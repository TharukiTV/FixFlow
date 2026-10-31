package com.fixflow.incident;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

// Business rule: a ticket can only be resolved when the technician records the cause and the fix.
class UpdateIncidentStatusRequestTest {
    private static Validator validator;

    @BeforeAll
    static void createValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void resolvingWithCauseAndResolutionIsValid() {
        var request = new UpdateIncidentStatusRequest(IncidentStatus.RESOLVED, "Worn washer", "Replaced the washer");
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void resolvingWithoutNotesIsRejected() {
        var request = new UpdateIncidentStatusRequest(IncidentStatus.RESOLVED, null, null);
        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void resolvingWithBlankNotesIsRejected() {
        var request = new UpdateIncidentStatusRequest(IncidentStatus.RESOLVED, "   ", "Replaced the washer");
        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void movingToInProgressDoesNotNeedNotes() {
        var request = new UpdateIncidentStatusRequest(IncidentStatus.IN_PROGRESS, null, null);
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void ticketWithEmptyDescriptionIsRejected() {
        var request = new CreateIncidentRequest(" ", "Library, floor 2");
        assertThat(validator.validate(request)).isNotEmpty();
    }
}
