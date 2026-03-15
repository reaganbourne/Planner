package com.reagan.planner.listitem;

public record ListItemResponse(
        Long id,
        Long listId,
        String title,
        String notes,
        boolean completed,
        Integer sortOrder
) {
}