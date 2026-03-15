package com.reagan.planner.workspace;

public record WorkspaceRecommendationItemResponse(
        String type,
        String title,
        String description,
        String actionLabel
) {
}
