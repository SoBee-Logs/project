package com.sobee.sobee.domain.mydata.controller;

import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class MyDataController {

    private final RestTemplate restTemplate;
    private final JwtUtil jwtUtil;

    @Value("${fastapi.base-url:http://localhost:8000}")
    private String fastapiBaseUrl;

    @Value("${fastapi.internal-secret:}")
    private String internalSecret;

    /** ENV에 등록된 기관 코드 목록 반환 (프론트 사전 검증용). */
    @GetMapping("/available")
    public ResponseEntity<?> getAvailableOrgs() {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<Map> response = restTemplate.exchange(
                    fastapiBaseUrl + "/internal/accounts/available-orgs",
                    HttpMethod.GET, entity, Map.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            log.error("available-orgs 조회 실패: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "기관 목록 조회 실패"));
        }
    }

    /** 선택한 기관 등록 + 30일 거래내역 sync 트리거. */
    @PostMapping("/register")
    public ResponseEntity<?> register(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, List<String>> body
    ) {
        Long userId = jwtUtil.getUserId(authHeader.replace("Bearer ", ""));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("user_id", userId);
        requestBody.put("bank_codes", body.getOrDefault("bankCodes", List.of()));
        requestBody.put("card_codes", body.getOrDefault("cardCodes", List.of()));

        HttpHeaders headers = buildHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    fastapiBaseUrl + "/internal/accounts/register-from-env",
                    entity, Map.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            log.error("register-from-env 실패: {}", e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", "기관 등록 실패"));
        } catch (Exception e) {
            log.error("register-from-env 오류: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "기관 등록 중 오류 발생"));
        }
    }

    /** sync + 아바타 생성 완료 여부 확인 (폴링용). */
    @GetMapping("/sync-status")
    public ResponseEntity<?> syncStatus(
            @RequestHeader("Authorization") String authHeader
    ) {
        Long userId = jwtUtil.getUserId(authHeader.replace("Bearer ", ""));
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<Map> response = restTemplate.exchange(
                    fastapiBaseUrl + "/internal/sync/status?user_id=" + userId,
                    HttpMethod.GET, entity, Map.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            log.warn("sync-status 확인 실패: {}", e.getMessage());
            return ResponseEntity.ok(Map.of("synced", false, "transaction_count", 0));
        }
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        if (internalSecret != null && !internalSecret.isBlank()) {
            headers.set("X-Internal-Secret", internalSecret);
        }
        return headers;
    }
}