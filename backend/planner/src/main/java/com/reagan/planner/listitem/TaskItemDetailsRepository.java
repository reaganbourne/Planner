package com.reagan.planner.listitem;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TaskItemDetailsRepository extends JpaRepository<TaskItemDetails, Long> {
    Optional<TaskItemDetails> findByItemIdAndItemListWorkspaceOwnerEmail(Long itemId, String email);
}