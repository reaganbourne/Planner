package com.reagan.planner.listitem;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "itinerary_item_details")
@Getter
@Setter
@NoArgsConstructor
public class ItineraryItemDetails {

    @Id
    @Column(name = "item_id")
    private Long itemId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "item_id")
    private ListItem item;

    @Column(name = "day_number")
    private Integer dayNumber;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "location_name", length = 255)
    private String locationName;

    @Column(length = 255)
    private String address;

    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "source_provider", length = 50)
    private String sourceProvider;

    @Column(name = "source_place_id", length = 255)
    private String sourcePlaceId;

    @Column(name = "source_rating", precision = 2, scale = 1)
    private BigDecimal sourceRating;

    @Column(name = "source_review_count")
    private Integer sourceReviewCount;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "reservation_url", columnDefinition = "TEXT")
    private String reservationUrl;
}
