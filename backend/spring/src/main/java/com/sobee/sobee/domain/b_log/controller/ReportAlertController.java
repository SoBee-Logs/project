package com.sobee.sobee.domain.b_log.controller;

import com.sobee.sobee.domain.b_log.dto.AlertBoardResponse;
import com.sobee.sobee.domain.b_log.service.ReportAlertService;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// GET /api/report/alert — 이번 주 목표 달성 현황 AlertBoard 반환
@RestController
@RequestMapping("/api/report")
@RequiredArgsConstructor
public class ReportAlertController {

    private final ReportAlertService reportAlertService;
    private final JwtUtil jwtUtil;

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("토큰이 없습니다.");
        }
        return jwtUtil.getUserId(authHeader.substring(7));
    }

    @GetMapping("/alert")
    public ResponseEntity<List<AlertBoardResponse>> getAlertBoards(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month
    ) {
        Long userId = extractUserId(authHeader);
        List<AlertBoardResponse> result = reportAlertService.getAlertBoards(userId, year, month);
        return ResponseEntity.ok(result);
    }
}
