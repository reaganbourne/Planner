package com.reagan.planner.places;

import java.math.BigDecimal;
import java.util.List;

public record PlaceSearchResultResponse(
        String id,
        String name,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        String provider,
        String url,
        List<String> categories
) {
}
