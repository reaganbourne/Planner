ALTER TABLE itinerary_item_details
    ADD COLUMN latitude NUMERIC(9, 6),
    ADD COLUMN longitude NUMERIC(9, 6),
    ADD COLUMN yelp_business_id VARCHAR(255),
    ADD COLUMN yelp_rating NUMERIC(2, 1),
    ADD COLUMN yelp_review_count INT,
    ADD COLUMN yelp_url TEXT;
