package com.reagan.planner.plannerlist;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreatePlannerListRequest(
        @NotBlank String name,
        @NotNull ListType type,
        String description
) {
}