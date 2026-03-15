CREATE TABLE itinerary_item_details (
    item_id BIGINT PRIMARY KEY REFERENCES list_items(id) ON DELETE CASCADE,
    day_number INT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    location_name VARCHAR(255),
    address VARCHAR(255),
    reservation_url TEXT
);