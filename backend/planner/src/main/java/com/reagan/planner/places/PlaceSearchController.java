package com.reagan.planner.places;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/places")
public class PlaceSearchController {

    private final PlaceSearchService placeSearchService;

    public PlaceSearchController(PlaceSearchService placeSearchService) {
        this.placeSearchService = placeSearchService;
    }

    @GetMapping("/search")
    public PlaceSearchResponse searchPlaces(
            @RequestParam String query,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Integer limit
    ) {
        return placeSearchService.searchPlaces(query, location, latitude, longitude, limit);
    }
}
