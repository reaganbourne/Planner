package com.reagan.planner.listitem;

public record UpdatePackingDetailsRequest(
        Integer quantity,
        String category,
        Boolean essential
) {
}