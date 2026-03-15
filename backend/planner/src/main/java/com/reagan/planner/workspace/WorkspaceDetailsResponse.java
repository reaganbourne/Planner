package com.reagan.planner.workspace;

import java.util.List;

public record WorkspaceDetailsResponse(
        Long id,
        String name,
        List<WorkspaceDetailsListResponse> lists
) {
}
