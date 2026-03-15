package com.reagan.planner.listitem;

import jakarta.validation.constraints.NotBlank;

public record CreateListItemRequest(
        @NotBlank String title,
        String notes
) {
}