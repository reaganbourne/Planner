CREATE TABLE task_item_details (
    item_id BIGINT PRIMARY KEY REFERENCES list_items(id) ON DELETE CASCADE,
    priority VARCHAR(50),
    due_at TIMESTAMP,
    status VARCHAR(50)
);