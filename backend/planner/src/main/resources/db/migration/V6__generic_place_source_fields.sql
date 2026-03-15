ALTER TABLE itinerary_item_details
    RENAME COLUMN yelp_business_id TO source_place_id;

ALTER TABLE itinerary_item_details
    RENAME COLUMN yelp_rating TO source_rating;

ALTER TABLE itinerary_item_details
    RENAME COLUMN yelp_review_count TO source_review_count;

ALTER TABLE itinerary_item_details
    RENAME COLUMN yelp_url TO source_url;

ALTER TABLE itinerary_item_details
    ADD COLUMN source_provider VARCHAR(50);
