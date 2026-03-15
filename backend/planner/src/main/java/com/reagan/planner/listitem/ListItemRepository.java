package com.reagan.planner.listitem;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ListItemRepository extends JpaRepository<ListItem, Long> {
    List<ListItem> findByListIdOrderBySortOrderAsc(Long listId);
    List<ListItem> findByListIdAndListWorkspaceOwnerEmailOrderBySortOrderAsc(Long listId, String email);
    Optional<ListItem> findByIdAndListWorkspaceOwnerEmail(Long itemId, String email);
}