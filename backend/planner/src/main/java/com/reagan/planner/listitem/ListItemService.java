package com.reagan.planner.listitem;

import com.reagan.planner.plannerlist.PlannerList;
import com.reagan.planner.plannerlist.PlannerListRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ListItemService {

    private final ListItemRepository listItemRepository;
    private final PlannerListRepository plannerListRepository;
    private final PackingItemDetailsRepository packingItemDetailsRepository;
    private final TaskItemDetailsRepository taskItemDetailsRepository;
    private final ItineraryItemDetailsRepository itineraryItemDetailsRepository;

    public ListItemService(
        ListItemRepository listItemRepository,
        PlannerListRepository plannerListRepository,
        PackingItemDetailsRepository packingItemDetailsRepository,
        TaskItemDetailsRepository taskItemDetailsRepository,
        ItineraryItemDetailsRepository itineraryItemDetailsRepository
) {
    this.listItemRepository = listItemRepository;
    this.plannerListRepository = plannerListRepository;
    this.packingItemDetailsRepository = packingItemDetailsRepository;
    this.taskItemDetailsRepository = taskItemDetailsRepository;
    this.itineraryItemDetailsRepository = itineraryItemDetailsRepository;
}

    public List<ListItemResponse> getItemsForList(Long listId, String email) {
        PlannerList plannerList = plannerListRepository.findByIdAndWorkspaceOwnerEmail(listId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "List not found"));

        return listItemRepository.findByListIdAndListWorkspaceOwnerEmailOrderBySortOrderAsc(plannerList.getId(), email)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ListItemResponse createItem(Long listId, CreateListItemRequest request, String email) {
        PlannerList plannerList = plannerListRepository.findByIdAndWorkspaceOwnerEmail(listId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "List not found"));

        int nextSortOrder = listItemRepository
                .findByListIdAndListWorkspaceOwnerEmailOrderBySortOrderAsc(listId, email)
                .size();

        ListItem item = new ListItem();
        item.setList(plannerList);
        item.setTitle(request.title());
        item.setNotes(request.notes());
        item.setCompleted(false);
        item.setSortOrder(nextSortOrder);

        return toResponse(listItemRepository.save(item));
    }

    public ListItemResponse updateItem(Long itemId, UpdateListItemRequest request, String email) {
        ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

        if (request.title() != null) {
            item.setTitle(request.title());
        }

        if (request.notes() != null) {
            item.setNotes(request.notes());
        }

        if (request.completed() != null) {
            item.setCompleted(request.completed());
        }

        return toResponse(listItemRepository.save(item));
    }

    public void deleteItem(Long itemId, String email) {
        ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

        listItemRepository.delete(item);
    }

    public List<ListItemResponse> reorderItems(Long listId, ReorderListItemsRequest request, String email) {
        PlannerList plannerList = plannerListRepository.findByIdAndWorkspaceOwnerEmail(listId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "List not found"));

        List<ListItem> items = listItemRepository
                .findByListIdAndListWorkspaceOwnerEmailOrderBySortOrderAsc(plannerList.getId(), email);

        if (items.size() != request.itemIds().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All list item ids must be provided");
        }

        Set<Long> existingIds = items.stream()
                .map(ListItem::getId)
                .collect(java.util.stream.Collectors.toSet());

        Set<Long> requestedIds = new HashSet<>(request.itemIds());

        if (!existingIds.equals(requestedIds)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item ids must match items in the list");
        }

        for (int i = 0; i < request.itemIds().size(); i++) {
            Long itemId = request.itemIds().get(i);

            ListItem item = items.stream()
                    .filter(currentItem -> currentItem.getId().equals(itemId))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid item id"));

            item.setSortOrder(i);
        }

        List<ListItem> savedItems = listItemRepository.saveAll(items);

        return savedItems.stream()
                .sorted(java.util.Comparator.comparing(ListItem::getSortOrder))
                .map(this::toResponse)
                .toList();
    }

    private ListItemResponse toResponse(ListItem item) {
        return new ListItemResponse(
                item.getId(),
                item.getList().getId(),
                item.getTitle(),
                item.getNotes(),
                item.isCompleted(),
                item.getSortOrder()
        );
    }

    public PackingDetailsResponse getPackingDetails(Long itemId, String email) {
    ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (item.getList().getType() != com.reagan.planner.plannerlist.ListType.PACKING) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not in a packing list");
    }

    PackingItemDetails details = packingItemDetailsRepository
            .findByItemIdAndItemListWorkspaceOwnerEmail(itemId, email)
            .orElseGet(() -> {
                PackingItemDetails newDetails = new PackingItemDetails();
                newDetails.setItem(item);
                newDetails.setQuantity(null);
                newDetails.setCategory(null);
                newDetails.setEssential(false);
                return packingItemDetailsRepository.save(newDetails);
            });

    return new PackingDetailsResponse(
            details.getItemId(),
            details.getQuantity(),
            details.getCategory(),
            details.isEssential()
    );
}

public PackingDetailsResponse updatePackingDetails(Long itemId, UpdatePackingDetailsRequest request, String email) {
    ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (item.getList().getType() != com.reagan.planner.plannerlist.ListType.PACKING) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not in a packing list");
    }

    PackingItemDetails details = packingItemDetailsRepository
            .findByItemIdAndItemListWorkspaceOwnerEmail(itemId, email)
            .orElseGet(() -> {
                PackingItemDetails newDetails = new PackingItemDetails();
                newDetails.setItem(item);
                newDetails.setEssential(false);
                return newDetails;
            });

    if (request.quantity() != null) {
        details.setQuantity(request.quantity());
    }

    if (request.category() != null) {
        details.setCategory(request.category());
    }

    if (request.essential() != null) {
        details.setEssential(request.essential());
    }

    PackingItemDetails savedDetails = packingItemDetailsRepository.save(details);

    return new PackingDetailsResponse(
            savedDetails.getItemId(),
            savedDetails.getQuantity(),
            savedDetails.getCategory(),
            savedDetails.isEssential()
    );
}

public TaskDetailsResponse getTaskDetails(Long itemId, String email) {
    ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (item.getList().getType() != com.reagan.planner.plannerlist.ListType.TASK) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not in a task list");
    }

    TaskItemDetails details = taskItemDetailsRepository
            .findByItemIdAndItemListWorkspaceOwnerEmail(itemId, email)
            .orElseGet(() -> {
                TaskItemDetails newDetails = new TaskItemDetails();
                newDetails.setItem(item);
                newDetails.setPriority(null);
                newDetails.setDueAt(null);
                newDetails.setStatus(null);
                return taskItemDetailsRepository.save(newDetails);
            });

    return new TaskDetailsResponse(
            details.getItemId(),
            details.getPriority(),
            details.getDueAt(),
            details.getStatus()
    );
}

public TaskDetailsResponse updateTaskDetails(Long itemId, UpdateTaskDetailsRequest request, String email) {
    ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (item.getList().getType() != com.reagan.planner.plannerlist.ListType.TASK) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not in a task list");
    }

    TaskItemDetails details = taskItemDetailsRepository
            .findByItemIdAndItemListWorkspaceOwnerEmail(itemId, email)
            .orElseGet(() -> {
                TaskItemDetails newDetails = new TaskItemDetails();
                newDetails.setItem(item);
                return newDetails;
            });

    if (request.priority() != null) {
        details.setPriority(request.priority());
    }

    if (request.dueAt() != null) {
        details.setDueAt(request.dueAt());
    }

    if (request.status() != null) {
        details.setStatus(request.status());
    }

    TaskItemDetails savedDetails = taskItemDetailsRepository.save(details);

    return new TaskDetailsResponse(
            savedDetails.getItemId(),
            savedDetails.getPriority(),
            savedDetails.getDueAt(),
            savedDetails.getStatus()
    );
}

public ItineraryDetailsResponse getItineraryDetails(Long itemId, String email) {
    ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (item.getList().getType() != com.reagan.planner.plannerlist.ListType.ITINERARY
            && item.getList().getType() != com.reagan.planner.plannerlist.ListType.PLACES) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not in an itinerary or places list");
    }

    ItineraryItemDetails details = itineraryItemDetailsRepository
            .findByItemIdAndItemListWorkspaceOwnerEmail(itemId, email)
            .orElseGet(() -> {
                ItineraryItemDetails newDetails = new ItineraryItemDetails();
                newDetails.setItem(item);
                newDetails.setDayNumber(null);
                newDetails.setStartTime(null);
                newDetails.setEndTime(null);
                newDetails.setLocationName(null);
                newDetails.setAddress(null);
                newDetails.setLatitude(null);
                newDetails.setLongitude(null);
                newDetails.setSourceProvider(null);
                newDetails.setSourcePlaceId(null);
                newDetails.setSourceRating(null);
                newDetails.setSourceReviewCount(null);
                newDetails.setSourceUrl(null);
                newDetails.setReservationUrl(null);
                return itineraryItemDetailsRepository.save(newDetails);
            });

    return toItineraryDetailsResponse(details);
}

public ItineraryDetailsResponse updateItineraryDetails(Long itemId, UpdateItineraryDetailsRequest request, String email) {
    ListItem item = listItemRepository.findByIdAndListWorkspaceOwnerEmail(itemId, email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

    if (item.getList().getType() != com.reagan.planner.plannerlist.ListType.ITINERARY
            && item.getList().getType() != com.reagan.planner.plannerlist.ListType.PLACES) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not in an itinerary or places list");
    }

    ItineraryItemDetails details = itineraryItemDetailsRepository
            .findByItemIdAndItemListWorkspaceOwnerEmail(itemId, email)
            .orElseGet(() -> {
                ItineraryItemDetails newDetails = new ItineraryItemDetails();
                newDetails.setItem(item);
                return newDetails;
            });

    // Always apply all fields so callers can clear values by sending null.
    // dayNumber, sourceRating, sourceReviewCount are not sent by the frontend PATCH
    // so we preserve the null-guard only for those three fields.
    if (request.dayNumber() != null) {
        details.setDayNumber(request.dayNumber());
    }

    details.setStartTime(request.startTime());
    details.setEndTime(request.endTime());
    details.setLocationName(request.locationName());
    details.setAddress(request.address());
    details.setLatitude(request.latitude());
    details.setLongitude(request.longitude());
    details.setSourceProvider(request.sourceProvider());
    details.setSourcePlaceId(request.sourcePlaceId());

    if (request.sourceRating() != null) {
        details.setSourceRating(request.sourceRating());
    }

    if (request.sourceReviewCount() != null) {
        details.setSourceReviewCount(request.sourceReviewCount());
    }

    details.setSourceUrl(request.sourceUrl());
    details.setReservationUrl(request.reservationUrl());

    ItineraryItemDetails savedDetails = itineraryItemDetailsRepository.save(details);

    return toItineraryDetailsResponse(savedDetails);
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
