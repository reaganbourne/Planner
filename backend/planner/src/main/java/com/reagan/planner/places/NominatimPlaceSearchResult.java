package com.reagan.planner.places;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NominatimPlaceSearchResult(
        @JsonProperty("place_id") Long placeId,
        @JsonProperty("display_name") String displayName,
        String name,
        String lat,
        String lon,
        @JsonProperty("category") String placeClass,
        String type,
        @JsonProperty("osm_type") String osmType,
        @JsonProperty("osm_id") Long osmId
) {
}
