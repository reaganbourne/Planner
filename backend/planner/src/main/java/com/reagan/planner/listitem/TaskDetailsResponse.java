package com.reagan.planner.listitem;

import java.time.LocalDateTime;

public record TaskDetailsResponse(
        Long itemId,
        String priority,
        LocalDateTime dueAt,
        String status
) {
}