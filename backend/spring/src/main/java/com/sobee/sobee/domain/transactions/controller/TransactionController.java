package com.sobee.sobee.domain.transactions.controller;

import com.sobee.sobee.domain.b_log.repository.TransactionRepository;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionRepository transactionRepository;
    private final JwtUtil jwtUtil;

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("토큰이 없습니다.");
        }
        return jwtUtil.getUserId(authHeader.substring(7));
    }

    @GetMapping("/top-category")
public ResponseEntity<Map<String, String>> getTopCategory(
        @RequestHeader("Authorization") String authHeader
) {
    Long userId = extractUserId(authHeader);
    LocalDate yesterday = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);
    String categoryName = transactionRepository.findTopCategoryNameByUserId(
            userId,
            yesterday.toString(),
            yesterday.toString()
    );
    return ResponseEntity.ok(Map.of("categoryName", categoryName != null ? categoryName : "기타"));
}
}