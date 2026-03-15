package com.reagan.planner;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.Iterator;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PlannerApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void workspaceListItemCrudFlowWorks() throws Exception {
        String token = registerAndGetToken();

        long workspaceId = createWorkspace(token, "Integration Workspace");
        long listId = createList(token, workspaceId, "Trip Tasks", "TASK");
        long itemId = createItem(token, listId, "Book hotel");
        long secondItemId = createItem(token, listId, "Reserve dinner");

        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}", workspaceId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].name").value("Trip Tasks"))
                .andExpect(jsonPath("$.lists[0].items[0].title").value("Book hotel"))
                .andExpect(jsonPath("$.lists[0].items[1].title").value("Reserve dinner"));

        mockMvc.perform(post("/api/v1/lists/{listId}/items/reorder", listId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "itemIds": [%d, %d]
                                }
                                """.formatted(secondItemId, itemId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Reserve dinner"))
                .andExpect(jsonPath("$[1].title").value("Book hotel"));

        mockMvc.perform(patch("/api/v1/items/{itemId}", itemId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "completed": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true));

        mockMvc.perform(delete("/api/v1/items/{itemId}", itemId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}", workspaceId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists[0].items[0].title").value("Reserve dinner"));
    }

    @Test
    void placesAndItineraryDetailsFlowWorks() throws Exception {
        String token = registerAndGetToken();

        long workspaceId = createWorkspace(token, "Places Workspace");
        long placesListId = createList(token, workspaceId, "Saved Places", "PLACES");
        long itineraryListId = createList(token, workspaceId, "Daily Plan", "ITINERARY");
        long placesItemId = createItem(token, placesListId, "Coffee Spot");
        long itineraryItemId = createItem(token, itineraryListId, "Morning Coffee");

        mockMvc.perform(patch("/api/v1/items/{itemId}/itinerary-details", placesItemId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "locationName": "Case Study Coffee",
                                  "address": "802 SW 10th Ave, Portland, OR",
                                  "latitude": 45.518212,
                                  "longitude": -122.681540,
                                  "sourceProvider": "OpenStreetMap",
                                  "sourcePlaceId": "12345",
                                  "sourceUrl": "https://www.openstreetmap.org/node/12345"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locationName").value("Case Study Coffee"));

        String start = LocalDateTime.of(2026, 6, 15, 9, 0).toString();
        String end = LocalDateTime.of(2026, 6, 15, 10, 0).toString();

        mockMvc.perform(patch("/api/v1/items/{itemId}/itinerary-details", itineraryItemId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "startTime": "%s",
                                  "endTime": "%s",
                                  "locationName": "Breakfast Meeting",
                                  "address": "Portland, OR"
                                }
                                """.formatted(start, end)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startTime").value(start + ":00"))
                .andExpect(jsonPath("$.endTime").value(end + ":00"));

        MvcResult workspaceResult = mockMvc.perform(get("/api/v1/workspaces/{workspaceId}", workspaceId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode workspaceJson = readJson(workspaceResult);
        JsonNode placesList = findList(workspaceJson, "PLACES", "Saved Places");
        JsonNode itineraryList = findList(workspaceJson, "ITINERARY", "Daily Plan");

        assertThat(placesList).isNotNull();
        assertThat(itineraryList).isNotNull();
        assertThat(placesList.get("items").size()).isEqualTo(1);
        assertThat(itineraryList.get("items").size()).isEqualTo(1);
        assertThat(placesList.get("items").get(0).get("itineraryDetails").get("locationName").asText())
                .isEqualTo("Case Study Coffee");
        assertThat(itineraryList.get("items").get(0).get("itineraryDetails").get("startTime").asText())
                .isEqualTo(start + ":00");
    }

    @Test
    void listAndWorkspaceDeleteEndpointsWork() throws Exception {
        String token = registerAndGetToken();

        long workspaceId = createWorkspace(token, "Delete Workspace");
        long listId = createList(token, workspaceId, "Delete Me", "TASK");

        mockMvc.perform(delete("/api/v1/lists/{listId}", listId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}", workspaceId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lists").isEmpty());

        mockMvc.perform(delete("/api/v1/workspaces/{workspaceId}", workspaceId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/workspaces")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    private String registerAndGetToken() throws Exception {
        String email = "test-" + UUID.randomUUID() + "@example.com";

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "password123"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = readJson(result);
        return json.get("token").asText();
    }

    private long createWorkspace(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/workspaces")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s"
                                }
                                """.formatted(name)))
                .andExpect(status().isCreated())
                .andReturn();

        return readJson(result).get("id").asLong();
    }

    private long createList(String token, long workspaceId, String name, String type) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/workspaces/{workspaceId}/lists", workspaceId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "type": "%s",
                                  "description": null
                                }
                                """.formatted(name, type)))
                .andExpect(status().isCreated())
                .andReturn();

        return readJson(result).get("id").asLong();
    }

    private long createItem(String token, long listId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/lists/{listId}/items", listId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "%s",
                                  "notes": null
                                }
                                """.formatted(title)))
                .andExpect(status().isCreated())
                .andReturn();

        return readJson(result).get("id").asLong();
    }

    private JsonNode readJson(MvcResult result) throws Exception {
        String content = result.getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(content);
        assertThat(json).isNotNull();
        return json;
    }

    private JsonNode findList(JsonNode workspaceJson, String type, String name) {
        Iterator<JsonNode> iterator = workspaceJson.get("lists").elements();
        while (iterator.hasNext()) {
            JsonNode list = iterator.next();
            if (type.equals(list.get("type").asText()) && name.equals(list.get("name").asText())) {
                return list;
            }
        }
        return null;
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
