package com.reagan.planner.plannerlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlannerListRepository extends JpaRepository<PlannerList, Long> {
    List<PlannerList> findByWorkspaceId(Long workspaceId);
    List<PlannerList> findByWorkspaceIdAndWorkspaceOwnerEmail(Long workspaceId, String email);
    Optional<PlannerList> findByIdAndWorkspaceOwnerEmail(Long id, String email);
}