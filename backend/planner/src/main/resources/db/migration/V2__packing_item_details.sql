CREATE TABLE packing_item_details (
    item_id BIGINT PRIMARY KEY REFERENCES list_items(id) ON DELETE CASCADE,
    quantity INT,
    category VARCHAR(100),
    essential BOOLEAN NOT NULL DEFAULT FALSE
);