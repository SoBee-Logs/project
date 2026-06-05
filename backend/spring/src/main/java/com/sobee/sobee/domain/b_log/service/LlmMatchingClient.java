package com.sobee.sobee.domain.b_log.service;

import lombok.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Component
@RequiredArgsConstructor
public class LlmMatchingClient {

    @Value("${fastapi.base-url}/api/mapping/match")
    private String mappingUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public List<MatchResponse> match(MatchRequest req) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<MatchRequest> entity = new HttpEntity<>(req, headers);
            ResponseEntity<MatchResponse[]> res = restTemplate.exchange(
                    mappingUrl, HttpMethod.POST, entity, MatchResponse[].class);
            if (res.getBody() == null) return List.of();
            return List.of(res.getBody());
        } catch (Exception e) {
            return List.of();
        }
    }

    @Getter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class MatchRequest {
        private Long photo_id;
        private Long user_id;
        private String taken_at;
        private String location;
        private List<VlmGroupItem> groups;
        private List<TransactionCandidate> candidates;
    }

    @Getter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class VlmGroupItem {
        private Integer group_id;
        private String store;
        private String category;
        private List<String> items;
        private Double price;
    }

    @Getter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class TransactionCandidate {
        private Long payment_id;
        private Integer payment_out;
        private String payment_time;
        private String payment_place;
        private String payment_category;
        private String payment_address;
    }

    @Getter @Setter @NoArgsConstructor
    public static class MatchResponse {
        private Integer group_id;
        private Long payment_id;
        private String reason;
    }
}