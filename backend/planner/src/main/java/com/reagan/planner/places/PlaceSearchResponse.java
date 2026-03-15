package com.reagan.planner.places;

import java.util.List;

public record PlaceSearchResponse(
        List<PlaceSearchResultResponse> businesses
) {
}
