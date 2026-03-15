package com.reagan.planner.listitem;

import java.time.LocalDateTime;
import java.math.BigDecimal;

public record ItineraryDetailsResponse(
        Long itemId,
        Integer dayNumber,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String locationName,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        String sourceProvider,
        String sourcePlaceId,
        BigDecimal sourceRating,
        Integer sourceReviewCount,
        String sourceUrl,
        String reservationUrl
) {
}
