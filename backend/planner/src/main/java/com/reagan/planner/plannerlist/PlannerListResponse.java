package com.reagan.planner.plannerlist;

public record PlannerListResponse(
        Long id,
        Long workspaceId,
        String name,
        ListType type,
        String description
) {
}