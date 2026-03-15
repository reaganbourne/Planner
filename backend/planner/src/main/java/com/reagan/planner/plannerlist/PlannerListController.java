package com.reagan.planner.plannerlist;

import com.reagan.planner.workspace.Workspace;
import com.reagan.planner.workspace.WorkspaceRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class PlannerListController {

    private final PlannerListRepository plannerListRepository;
    private final WorkspaceRepository workspaceRepository;

    public PlannerListController(
            PlannerListRepository plannerListRepository,
            WorkspaceRepository workspaceRepository
    ) {
        this.plannerListRepository = plannerListRepository;
        this.workspaceRepository = workspaceRepository;
    }

    @GetMapping("/workspaces/{workspaceId}/lists")
    public List<PlannerListResponse> getListsForWorkspace(
            @PathVariable Long workspaceId,
            Authentication authentication
    ) {
        String email = authentication.getName();

        Workspace workspace = workspaceRepository.findByIdAndOwnerEmail(workspaceId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));

        return plannerListRepository.findByWorkspaceIdAndWorkspaceOwnerEmail(workspace.getId(), email)
                .stream()
                .map(plannerList -> new PlannerListResponse(
                        plannerList.getId(),
                        plannerList.getWorkspace().getId(),
                        plannerList.getName(),
                        plannerList.getType(),
                        plannerList.getDescription()
                ))
                .toList();
    }

    @PostMapping("/workspaces/{workspaceId}/lists")
    @ResponseStatus(HttpStatus.CREATED)
    public PlannerListResponse createList(
            @PathVariable Long workspaceId,
            @Valid @RequestBody CreatePlannerListRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();

        Workspace workspace = workspaceRepository.findByIdAndOwnerEmail(workspaceId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));

        PlannerList plannerList = new PlannerList();
        plannerList.setWorkspace(workspace);
        plannerList.setName(request.name());
        plannerList.setType(request.type());
        plannerList.setDescription(request.description());

        PlannerList savedList = plannerListRepository.save(plannerList);

        return new PlannerListResponse(
                savedList.getId(),
                savedList.getWorkspace().getId(),
                savedList.getName(),
                savedList.getType(),
                savedList.getDescription()
        );
    }

    @PatchMapping("/lists/{listId}")
    public PlannerListResponse updateList(
            @PathVariable Long listId,
            @RequestBody UpdatePlannerListRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();

        PlannerList plannerList = plannerListRepository.findByIdAndWorkspaceOwnerEmail(listId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "List not found"));

        if (request.name() != null && !request.name().isBlank()) {
            plannerList.setName(request.name().trim());
        }

        PlannerList savedList = plannerListRepository.save(plannerList);

        return new PlannerListResponse(
                savedList.getId(),
                savedList.getWorkspace().getId(),
                savedList.getName(),
                savedList.getType(),
                savedList.getDescription()
        );
    }

    @DeleteMapping("/lists/{listId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteList(
            @PathVariable Long listId,
            Authentication authentication
    ) {
        String email = authentication.getName();

        PlannerList plannerList = plannerListRepository.findByIdAndWorkspaceOwnerEmail(listId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "List not found"));

        plannerListRepository.delete(plannerList);
    }
}
