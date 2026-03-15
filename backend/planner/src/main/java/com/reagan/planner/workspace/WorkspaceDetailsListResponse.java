package com.reagan.planner.workspace;

import com.reagan.planner.plannerlist.ListType;

import java.util.List;

public record WorkspaceDetailsListResponse(
        Long id,
        Long workspaceId,
        String name,
        ListType type,
        String description,
        List<WorkspaceDetailsItemResponse> items
) {
}
