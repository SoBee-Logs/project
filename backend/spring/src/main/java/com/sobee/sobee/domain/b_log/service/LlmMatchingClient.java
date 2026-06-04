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

    // FastAPI로 매핑 요청 보내고 payment_id 반환 — null이면 미매핑
    public Long match(MatchRequest req) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<MatchRequest> entity = new HttpEntity<>(req, headers);

            ResponseEntity<MatchResponse> res = restTemplate.exchange(
                    mappingUrl,
                    HttpMethod.POST,
                    entity,
                    MatchResponse.class
            );

            if (res.getBody() == null) return null;
            return res.getBody().getPayment_id();
        } catch (Exception e) {
            return null;  // 실패 시 미매핑
        }
    }

    // Request DTO
    @Getter @Builder
    @AllArgsConstructor @NoArgsConstructor
    public static class MatchRequest {
        private Long photo_id;
        private Long user_id;
        private VlmData vlm_data;
        private List<TransactionCandidate> candidates;
    }

    @Getter @Builder
    @AllArgsConstructor @NoArgsConstructor
    public static class VlmData {
        private String category;
        private String item_name;
        private Double price_estimate;
        private String store_type;
        private String store_name;
        private String description;
        private String taken_at;
        private Double latitude;
        private Double longitude;
    }

    @Getter @Builder
    @AllArgsConstructor @NoArgsConstructor
    public static class TransactionCandidate {
        private Long payment_id;
        private Integer payment_out;
        private String payment_time;
        private String payment_place;
        private String payment_category;
        private String payment_address;
    }

    // Response DTO
    @Getter @Setter
    @NoArgsConstructor
    public static class MatchResponse {
        private Long payment_id;
        private String reason;
    }
}