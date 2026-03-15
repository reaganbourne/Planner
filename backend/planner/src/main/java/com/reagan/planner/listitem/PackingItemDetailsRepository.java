package com.reagan.planner.listitem;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PackingItemDetailsRepository extends JpaRepository<PackingItemDetails, Long> {
    Optional<PackingItemDetails> findByItemIdAndItemListWorkspaceOwnerEmail(Long itemId, String email);
}