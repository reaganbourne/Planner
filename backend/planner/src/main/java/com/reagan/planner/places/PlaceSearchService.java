package com.reagan.planner.places;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlaceSearchService {

    private final RestClient restClient;
    private final String contactEmail;
    private final Map<String, PlaceSearchResponse> cache = new ConcurrentHashMap<>();
    private Instant lastRequestAt = Instant.EPOCH;

    public PlaceSearchService(
            @Value("${nominatim.base-url}") String baseUrl,
            @Value("${nominatim.email:}") String contactEmail,
            @Value("${nominatim.user-agent}") String userAgent
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.contactEmail = contactEmail;
    }

    public PlaceSearchResponse searchPlaces(
            String query,
            String location,
            Double latitude,
            Double longitude,
            Integer limit
    ) {
        String normalizedQuery = blankToNull(query);
        if (normalizedQuery == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Query is required.");
        }

        String compositeQuery = buildQuery(normalizedQuery, blankToNull(location));
        String cacheKey = compositeQuery + "|" + latitude + "|" + longitude + "|" + limit;
        PlaceSearchResponse cachedResponse = cache.get(cacheKey);

        if (cachedResponse != null) {
            return cachedResponse;
        }

        throttleIfNeeded();

        String uri = UriComponentsBuilder.fromPath("/search")
                .queryParam("q", compositeQuery)
                .queryParam("format", "jsonv2")
                .queryParam("limit", limit == null ? 8 : Math.min(limit, 20))
                .queryParam("addressdetails", 1)
                .queryParam("extratags", 1)
                .queryParam("namedetails", 1)
                .queryParamIfPresent("viewbox", java.util.Optional.ofNullable(toViewbox(latitude, longitude)))
                .queryParamIfPresent("bounded", java.util.Optional.ofNullable(latitude != null && longitude != null ? 1 : null))
                .queryParamIfPresent("email", java.util.Optional.ofNullable(blankToNull(contactEmail)))
                .build()
                .toUriString();

        NominatimPlaceSearchResult[] response = restClient.get()
                .uri(uri)
                .retrieve()
                .body(NominatimPlaceSearchResult[].class);

        List<PlaceSearchResultResponse> businesses = response == null
                ? List.of()
                : java.util.Arrays.stream(response)
                .map(this::toResponse)
                .toList();

        PlaceSearchResponse searchResponse = new PlaceSearchResponse(businesses);
        cache.put(cacheKey, searchResponse);
        return searchResponse;
    }

    private synchronized void throttleIfNeeded() {
        Duration elapsed = Duration.between(lastRequestAt, Instant.now());
        long millisToWait = 1100 - elapsed.toMillis();

        if (millisToWait > 0) {
            try {
                Thread.sleep(millisToWait);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        }

        lastRequestAt = Instant.now();
    }

    private String buildQuery(String query, String location) {
        return location == null ? query : query + ", " + location;
    }

    private String toViewbox(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            return null;
        }

        double delta = 0.08;
        double left = longitude - delta;
        double top = latitude + delta;
        double right = longitude + delta;
        double bottom = latitude - delta;
        return left + "," + top + "," + right + "," + bottom;
    }

    private PlaceSearchResultResponse toResponse(NominatimPlaceSearchResult place) {
        List<String> categories = List.of(formatCategory(place.placeClass()), formatCategory(place.type())).stream()
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .toList();

        String address = place.displayName();
        String placeName = blankToNull(place.name()) != null ? place.name() : firstSegment(place.displayName());

        return new PlaceSearchResultResponse(
                String.valueOf(place.placeId()),
                placeName,
                address,
                parseDecimal(place.lat()),
                parseDecimal(place.lon()),
                "OpenStreetMap",
                toOpenStreetMapUrl(place),
                categories
        );
    }

    private BigDecimal parseDecimal(String value) {
        return value == null || value.isBlank() ? null : new BigDecimal(value);
    }

    private String toOpenStreetMapUrl(NominatimPlaceSearchResult place) {
        if (place.osmType() == null || place.osmId() == null) {
            return null;
        }

        return "https://www.openstreetmap.org/" + place.osmType().toLowerCase() + "/" + place.osmId();
    }

    private String firstSegment(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        int separatorIndex = value.indexOf(',');
        return separatorIndex >= 0 ? value.substring(0, separatorIndex).trim() : value.trim();
    }

    private String formatCategory(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.replace('_', ' ');
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
