package com.reagan.planner.listitem;

public record UpdateListItemRequest(
        String title,
        String notes,
        Boolean completed
) {
}