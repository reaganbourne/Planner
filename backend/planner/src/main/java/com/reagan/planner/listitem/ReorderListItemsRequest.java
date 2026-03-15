package com.reagan.planner.listitem;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ReorderListItemsRequest(
        @NotEmpty List<Long> itemIds
) {
}