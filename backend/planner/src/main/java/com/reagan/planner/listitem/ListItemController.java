package com.reagan.planner.listitem;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class ListItemController {

    private final ListItemService listItemService;

    public ListItemController(ListItemService listItemService) {
        this.listItemService = listItemService;
    }

    @GetMapping("/lists/{listId}/items")
    public List<ListItemResponse> getItemsForList(
            @PathVariable Long listId,
            Authentication authentication
    ) {
        return listItemService.getItemsForList(listId, authentication.getName());
    }

    @PostMapping("/lists/{listId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ListItemResponse createItem(
            @PathVariable Long listId,
            @Valid @RequestBody CreateListItemRequest request,
            Authentication authentication
    ) {
        return listItemService.createItem(listId, request, authentication.getName());
    }

    @PatchMapping("/items/{itemId}")
    public ListItemResponse updateItem(
            @PathVariable Long itemId,
            @RequestBody UpdateListItemRequest request,
            Authentication authentication
    ) {
        return listItemService.updateItem(itemId, request, authentication.getName());
    }

    @DeleteMapping("/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        listItemService.deleteItem(itemId, authentication.getName());
    }

    @PostMapping("/lists/{listId}/items/reorder")
    public List<ListItemResponse> reorderItems(
            @PathVariable Long listId,
            @Valid @RequestBody ReorderListItemsRequest request,
            Authentication authentication
    ) {
        return listItemService.reorderItems(listId, request, authentication.getName());
    }

    @GetMapping("/items/{itemId}/packing-details")
    public PackingDetailsResponse getPackingDetails(
        @PathVariable Long itemId,
        Authentication authentication
    ) {
    return listItemService.getPackingDetails(itemId, authentication.getName());
    }

    @PatchMapping("/items/{itemId}/packing-details")
    public PackingDetailsResponse updatePackingDetails(
            @PathVariable Long itemId,
            @RequestBody UpdatePackingDetailsRequest request,
            Authentication authentication
    ) {
        return listItemService.updatePackingDetails(itemId, request, authentication.getName());
    }

    @GetMapping("/items/{itemId}/task-details")
    public TaskDetailsResponse getTaskDetails(
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        return listItemService.getTaskDetails(itemId, authentication.getName());
    }

    @PatchMapping("/items/{itemId}/task-details")
    public TaskDetailsResponse updateTaskDetails(
            @PathVariable Long itemId,
            @RequestBody UpdateTaskDetailsRequest request,
            Authentication authentication
    ) {
        return listItemService.updateTaskDetails(itemId, request, authentication.getName());
    }

    @GetMapping("/items/{itemId}/itinerary-details")
    public ItineraryDetailsResponse getItineraryDetails(
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        return listItemService.getItineraryDetails(itemId, authentication.getName());
    }

    @PatchMapping("/items/{itemId}/itinerary-details")
    public ItineraryDetailsResponse updateItineraryDetails(
            @PathVariable Long itemId,
            @RequestBody UpdateItineraryDetailsRequest request,
            Authentication authentication
    ) {
        return listItemService.updateItineraryDetails(itemId, request, authentication.getName());
    }
}