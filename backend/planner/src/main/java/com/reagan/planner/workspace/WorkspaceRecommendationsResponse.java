package com.reagan.planner.workspace;

import java.util.List;

public record WorkspaceRecommendationsResponse(
        Long workspaceId,
        List<WorkspaceRecommendationItemResponse> recommendations
) {
}
