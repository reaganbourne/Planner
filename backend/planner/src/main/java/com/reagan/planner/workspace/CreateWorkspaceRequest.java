package com.reagan.planner.workspace;

import jakarta.validation.constraints.NotBlank;

public record CreateWorkspaceRequest(
        @NotBlank String name
) {
}