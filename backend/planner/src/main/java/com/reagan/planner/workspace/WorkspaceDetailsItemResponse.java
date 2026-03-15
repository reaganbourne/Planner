package com.reagan.planner.workspace;

import com.reagan.planner.listitem.ItineraryDetailsResponse;
import com.reagan.planner.listitem.PackingDetailsResponse;
import com.reagan.planner.listitem.TaskDetailsResponse;

public record WorkspaceDetailsItemResponse(
        Long id,
        Long listId,
        String title,
        String notes,
        boolean completed,
        Integer sortOrder,
        PackingDetailsResponse packingDetails,
        TaskDetailsResponse taskDetails,
        ItineraryDetailsResponse itineraryDetails
) {
}
