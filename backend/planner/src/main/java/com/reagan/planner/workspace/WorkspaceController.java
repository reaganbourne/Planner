package com.reagan.planner.workspace;

import com.reagan.planner.user.User;
import com.reagan.planner.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces")
public class WorkspaceController {

    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final WorkspaceService workspaceService;

    public WorkspaceController(
            WorkspaceRepository workspaceRepository,
            UserRepository userRepository,
            WorkspaceService workspaceService
    ) {
        this.workspaceRepository = workspaceRepository;
        this.userRepository = userRepository;
        this.workspaceService = workspaceService;
    }

    @GetMapping
    public List<WorkspaceResponse> getWorkspaces(Authentication authentication) {
        String email = authentication.getName();

        return workspaceRepository.findByOwnerEmail(email)
                .stream()
                .map(workspace -> new WorkspaceResponse(
                        workspace.getId(),
                        workspace.getName()
                ))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponse createWorkspace(
            @Valid @RequestBody CreateWorkspaceRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();

        User owner = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Workspace workspace = new Workspace();
        workspace.setName(request.name());
        workspace.setOwner(owner);

        Workspace savedWorkspace = workspaceRepository.save(workspace);

        return new WorkspaceResponse(
                savedWorkspace.getId(),
                savedWorkspace.getName()
        );
    }

    @DeleteMapping("/{workspaceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWorkspace(
            @PathVariable Long workspaceId,
            Authentication authentication
    ) {
        String email = authentication.getName();

        Workspace workspace = workspaceRepository.findByIdAndOwnerEmail(workspaceId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));

        workspaceRepository.delete(workspace);
    }

    @GetMapping("/{workspaceId}")
    public WorkspaceDetailsResponse getWorkspaceDetails(
            @PathVariable Long workspaceId,
            Authentication authentication
    ) {
        return workspaceService.getWorkspaceDetails(workspaceId, authentication.getName());
    }

    @GetMapping("/{workspaceId}/recommendations")
    public WorkspaceRecommendationsResponse getWorkspaceRecommendations(
            @PathVariable Long workspaceId,
            Authentication authentication
    ) {
        return workspaceService.getWorkspaceRecommendations(workspaceId, authentication.getName());
    }
}
