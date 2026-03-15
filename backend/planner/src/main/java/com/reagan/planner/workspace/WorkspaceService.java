package com.reagan.planner.workspace;

import com.reagan.planner.listitem.ItineraryDetailsResponse;
import com.reagan.planner.listitem.ItineraryItemDetails;
import com.reagan.planner.listitem.ItineraryItemDetailsRepository;
import com.reagan.planner.listitem.ListItem;
import com.reagan.planner.listitem.ListItemRepository;
import com.reagan.planner.listitem.PackingDetailsResponse;
import com.reagan.planner.listitem.PackingItemDetails;
import com.reagan.planner.listitem.PackingItemDetailsRepository;
import com.reagan.planner.listitem.TaskDetailsResponse;
import com.reagan.planner.listitem.TaskItemDetails;
import com.reagan.planner.listitem.TaskItemDetailsRepository;
import com.reagan.planner.plannerlist.ListType;
import com.reagan.planner.plannerlist.PlannerList;
import com.reagan.planner.plannerlist.PlannerListRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final PlannerListRepository plannerListRepository;
    private final ListItemRepository listItemRepository;
    private final PackingItemDetailsRepository packingItemDetailsRepository;
    private final TaskItemDetailsRepository taskItemDetailsRepository;
    private final ItineraryItemDetailsRepository itineraryItemDetailsRepository;
    private final WorkspaceRecommendationService workspaceRecommendationService;

    public WorkspaceService(
            WorkspaceRepository workspaceRepository,
            PlannerListRepository plannerListRepository,
            ListItemRepository listItemRepository,
            PackingItemDetailsRepository packingItemDetailsRepository,
            TaskItemDetailsRepository taskItemDetailsRepository,
            ItineraryItemDetailsRepository itineraryItemDetailsRepository,
            WorkspaceRecommendationService workspaceRecommendationService
    ) {
        this.workspaceRepository = workspaceRepository;
        this.plannerListRepository = plannerListRepository;
        this.listItemRepository = listItemRepository;
        this.packingItemDetailsRepository = packingItemDetailsRepository;
        this.taskItemDetailsRepository = taskItemDetailsRepository;
        this.itineraryItemDetailsRepository = itineraryItemDetailsRepository;
        this.workspaceRecommendationService = workspaceRecommendationService;
    }

    public WorkspaceDetailsResponse getWorkspaceDetails(Long workspaceId, String email) {
        Workspace workspace = workspaceRepository.findByIdAndOwnerEmail(workspaceId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));

        List<WorkspaceDetailsListResponse> lists = plannerListRepository
                .findByWorkspaceIdAndWorkspaceOwnerEmail(workspaceId, email)
                .stream()
                .map(this::toWorkspaceListResponse)
                .toList();

        return new WorkspaceDetailsResponse(
                workspace.getId(),
                workspace.getName(),
                lists
        );
    }

    public WorkspaceRecommendationsResponse getWorkspaceRecommendations(Long workspaceId, String email) {
        return workspaceRecommendationService.getRecommendations(workspaceId, email);
    }

    private WorkspaceDetailsListResponse toWorkspaceListResponse(PlannerList plannerList) {
        List<WorkspaceDetailsItemResponse> items = listItemRepository
                .findByListIdOrderBySortOrderAsc(plannerList.getId())
                .stream()
                .map(item -> toWorkspaceItemResponse(item, plannerList.getType()))
                .toList();

        return new WorkspaceDetailsListResponse(
                plannerList.getId(),
                plannerList.getWorkspace().getId(),
                plannerList.getName(),
                plannerList.getType(),
                plannerList.getDescription(),
                items
        );
    }

    private WorkspaceDetailsItemResponse toWorkspaceItemResponse(ListItem item, ListType listType) {
        PackingDetailsResponse packingDetails = null;
        TaskDetailsResponse taskDetails = null;
        ItineraryDetailsResponse itineraryDetails = null;

        if (listType == ListType.PACKING) {
            packingDetails = packingItemDetailsRepository.findById(item.getId())
                    .map(this::toPackingDetailsResponse)
                    .orElse(null);
        }

        if (listType == ListType.TASK) {
            taskDetails = taskItemDetailsRepository.findById(item.getId())
                    .map(this::toTaskDetailsResponse)
                    .orElse(null);
        }

        if (listType == ListType.ITINERARY || listType == ListType.PLACES) {
            itineraryDetails = itineraryItemDetailsRepository.findById(item.getId())
                    .map(this::toItineraryDetailsResponse)
                    .orElse(null);
        }

        return new WorkspaceDetailsItemResponse(
                item.getId(),
                item.getList().getId(),
                item.getTitle(),
                item.getNotes(),
                item.isCompleted(),
                item.getSortOrder(),
                packingDetails,
                taskDetails,
                itineraryDetails
        );
    }

    private PackingDetailsResponse toPackingDetailsResponse(PackingItemDetails details) {
        return new PackingDetailsResponse(
                details.getItemId(),
                details.getQuantity(),
                details.getCategory(),
                details.isEssential()
        );
    }

    private TaskDetailsResponse toTaskDetailsResponse(TaskItemDetails details) {
        return new TaskDetailsResponse(
                details.getItemId(),
                details.getPriority(),
                details.getDueAt(),
                details.getStatus()
        );
    }

    private ItineraryDetailsResponse toItineraryDetailsResponse(ItineraryItemDetails details) {
        return new ItineraryDetailsResponse(
                details.getItemId(),
                details.getDayNumber(),
                details.getStartTime(),
                details.getEndTime(),
                details.getLocationName(),
                details.getAddress(),
                details.getLatitude(),
                details.getLongitude(),
                details.getSourceProvider(),
                details.getSourcePlaceId(),
                details.getSourceRating(),
                details.getSourceReviewCount(),
                details.getSourceUrl(),
                details.getReservationUrl()
        );
    }
}
