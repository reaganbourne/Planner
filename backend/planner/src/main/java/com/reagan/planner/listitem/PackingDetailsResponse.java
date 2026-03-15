package com.reagan.planner.listitem;

public record PackingDetailsResponse(
        Long itemId,
        Integer quantity,
        String category,
        boolean essential
) {
}