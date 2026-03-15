package com.reagan.planner.workspace;

import com.reagan.planner.listitem.ItineraryItemDetailsRepository;
import com.reagan.planner.listitem.ListItemRepository;
import com.reagan.planner.listitem.TaskItemDetailsRepository;
import com.reagan.planner.plannerlist.ListType;
import com.reagan.planner.plannerlist.PlannerList;
import com.reagan.planner.plannerlist.PlannerListRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
public class WorkspaceRecommendationService {

    private final WorkspaceRepository workspaceRepository;
    private final PlannerListRepository plannerListRepository;
    private final ListItemRepository listItemRepository;
    private final TaskItemDetailsRepository taskItemDetailsRepository;
    private final ItineraryItemDetailsRepository itineraryItemDetailsRepository;

    public WorkspaceRecommendationService(
            WorkspaceRepository workspaceRepository,
            PlannerListRepository plannerListRepository,
            ListItemRepository listItemRepository,
            TaskItemDetailsRepository taskItemDetailsRepository,
            ItineraryItemDetailsRepository itineraryItemDetailsRepository
    ) {
        this.workspaceRepository = workspaceRepository;
        this.plannerListRepository = plannerListRepository;
        this.listItemRepository = listItemRepository;
        this.taskItemDetailsRepository = taskItemDetailsRepository;
        this.itineraryItemDetailsRepository = itineraryItemDetailsRepository;
    }

    public WorkspaceRecommendationsResponse getRecommendations(Long workspaceId, String email) {
        Workspace workspace = workspaceRepository.findByIdAndOwnerEmail(workspaceId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));

        List<PlannerList> lists = plannerListRepository.findByWorkspaceIdAndWorkspaceOwnerEmail(workspaceId, email);
        List<WorkspaceRecommendationItemResponse> recommendations = new ArrayList<>();

        boolean hasTaskList = lists.stream().anyMatch(list -> list.getType() == ListType.TASK);
        boolean hasPackingList = lists.stream().anyMatch(list -> list.getType() == ListType.PACKING);
        boolean hasItineraryList = lists.stream().anyMatch(list -> list.getType() == ListType.ITINERARY);

        if (!hasTaskList) {
            recommendations.add(new WorkspaceRecommendationItemResponse(
                    "CREATE_TASK_LIST",
                    "Add a trip task list",
                    "Create a task list for bookings, check-in reminders, visas, and pre-trip errands.",
                    "Create TASK list"
            ));
        }

        if (!hasPackingList) {
            recommendations.add(new WorkspaceRecommendationItemResponse(
                    "CREATE_PACKING_LIST",
                    "Add a packing list",
                    "A packing list helps this workspace cover essentials before the trip gets busy.",
                    "Create PACKING list"
            ));
        }

        if (!hasItineraryList) {
            recommendations.add(new WorkspaceRecommendationItemResponse(
                    "CREATE_ITINERARY_LIST",
                    "Add an itinerary list",
                    "An itinerary list unlocks the calendar and map views for this workspace.",
                    "Create ITINERARY list"
            ));
        }

        long itineraryListCount = lists.stream()
                .filter(list -> list.getType() == ListType.ITINERARY)
                .count();

        if (itineraryListCount > 0) {
            long itineraryItemCount = lists.stream()
                    .filter(list -> list.getType() == ListType.ITINERARY)
                    .mapToLong(list -> listItemRepository.findByListIdOrderBySortOrderAsc(list.getId()).size())
                    .sum();

            long scheduledItineraryItemCount = lists.stream()
                    .filter(list -> list.getType() == ListType.ITINERARY)
                    .flatMap(list -> listItemRepository.findByListIdOrderBySortOrderAsc(list.getId()).stream())
                    .filter(item -> itineraryItemDetailsRepository.findById(item.getId())
                            .map(details -> details.getStartTime() != null || details.getDayNumber() != null)
                            .orElse(false))
                    .count();

            long pinnedItineraryItemCount = lists.stream()
                    .filter(list -> list.getType() == ListType.ITINERARY)
                    .flatMap(list -> listItemRepository.findByListIdOrderBySortOrderAsc(list.getId()).stream())
                    .filter(item -> itineraryItemDetailsRepository.findById(item.getId())
                            .map(details -> details.getLatitude() != null && details.getLongitude() != null)
                            .orElse(false))
                    .count();

            long linkedPlaceCount = lists.stream()
                    .filter(list -> list.getType() == ListType.ITINERARY)
                    .flatMap(list -> listItemRepository.findByListIdOrderBySortOrderAsc(list.getId()).stream())
                    .filter(item -> itineraryItemDetailsRepository.findById(item.getId())
                            .map(details -> details.getSourcePlaceId() != null && !details.getSourcePlaceId().isBlank())
                            .orElse(false))
                    .count();

            if (itineraryItemCount > 0 && scheduledItineraryItemCount < itineraryItemCount) {
                recommendations.add(new WorkspaceRecommendationItemResponse(
                        "SCHEDULE_ITINERARY",
                        "Schedule the remaining itinerary stops",
                        "Add day numbers or start times so the calendar view becomes more useful.",
                        "Add schedule details"
                ));
            }

            if (itineraryItemCount > 0 && pinnedItineraryItemCount < itineraryItemCount) {
                recommendations.add(new WorkspaceRecommendationItemResponse(
                        "PIN_ITINERARY_STOPS",
                        "Pin itinerary stops on the map",
                        "Add coordinates to more stops so the workspace map reflects your route.",
                        "Add map pins"
                ));
            }

            if (itineraryItemCount > 0 && linkedPlaceCount < itineraryItemCount) {
                recommendations.add(new WorkspaceRecommendationItemResponse(
                        "LINK_PLACE_SEARCH_RESULTS",
                        "Attach place search results to itinerary stops",
                        "Search free OpenStreetMap place data for restaurants, cafes, parks, and attractions so each stop carries a real location and map pin.",
                        "Search places"
                ));
            }
        }

        if (hasTaskList) {
            long taskItemCount = lists.stream()
                    .filter(list -> list.getType() == ListType.TASK)
                    .mapToLong(list -> listItemRepository.findByListIdOrderBySortOrderAsc(list.getId()).size())
                    .sum();

            long taskItemsWithDueDates = lists.stream()
                    .filter(list -> list.getType() == ListType.TASK)
                    .flatMap(list -> listItemRepository.findByListIdOrderBySortOrderAsc(list.getId()).stream())
                    .filter(item -> taskItemDetailsRepository.findById(item.getId())
                            .map(details -> details.getDueAt() != null)
                            .orElse(false))
                    .count();

            if (taskItemCount > 0 && taskItemsWithDueDates < taskItemCount) {
                recommendations.add(new WorkspaceRecommendationItemResponse(
                        "ADD_TASK_DEADLINES",
                        "Give tasks due dates",
                        "Adding deadlines makes trip prep easier to prioritize before departure.",
                        "Set due dates"
                ));
            }
        }

        if (recommendations.isEmpty()) {
            recommendations.add(new WorkspaceRecommendationItemResponse(
                    "WORKSPACE_LOOKS_STRONG",
                    "This workspace is in good shape",
                    "The core lists, itinerary structure, and place details are already filled in. The next best move is refining stops with better place search coverage or smarter AI suggestions.",
                    "Review workspace"
            ));
        }

        return new WorkspaceRecommendationsResponse(workspace.getId(), recommendations);
    }
}
