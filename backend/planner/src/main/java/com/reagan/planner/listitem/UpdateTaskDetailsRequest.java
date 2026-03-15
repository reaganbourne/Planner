package com.reagan.planner.listitem;

import java.time.LocalDateTime;

public record UpdateTaskDetailsRequest(
        String priority,
        LocalDateTime dueAt,
        String status
) {
}