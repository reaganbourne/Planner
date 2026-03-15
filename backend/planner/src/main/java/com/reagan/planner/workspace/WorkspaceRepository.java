package com.reagan.planner.workspace;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
    List<Workspace> findByOwnerEmail(String email);
    Optional<Workspace> findByIdAndOwnerEmail(Long id, String email);
}