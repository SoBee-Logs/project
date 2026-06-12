package com.sobee.sobee.domain.b_log.controller;

import com.sobee.sobee.domain.b_log.dto.DiaryFeedItemResponse;
import com.sobee.sobee.domain.b_log.dto.DiaryGenerateRequest;
import com.sobee.sobee.domain.b_log.dto.DiaryGenerateResponse;
import com.sobee.sobee.domain.b_log.dto.DiaryPreviewBatchResponse;
import com.sobee.sobee.domain.b_log.dto.DiaryPreviewResponse;
import com.sobee.sobee.domain.b_log.dto.DiarySaveRequest;
import com.sobee.sobee.domain.b_log.service.DiaryService;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/diary")
@RequiredArgsConstructor
public class DiaryController {

    private final DiaryService diaryService;
    private final JwtUtil jwtUtil;

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("토큰이 없습니다.");
        }
        return jwtUtil.getUserId(authHeader.substring(7));
    }

    @PostMapping("/generate")
    public ResponseEntity<DiaryGenerateResponse> generateDiary(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody DiaryGenerateRequest request
    ) {
        Long userId = extractUserId(authHeader);
        try {
            DiaryGenerateResponse response = diaryService.generateDiary(request, userId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();  // 400
        }
    }

    @PostMapping("/save")
    public ResponseEntity<Void> saveDiary(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody DiarySaveRequest request
    ) {
        Long userId = extractUserId(authHeader);
        diaryService.saveDiary(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping("/list")
    public ResponseEntity<List<DiaryFeedItemResponse>> getDiaryList(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam Long groupId
    ) {
        extractUserId(authHeader);
        List<DiaryFeedItemResponse> response = diaryService.getDiaryList(groupId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{diaryId}/like")
    public ResponseEntity<Void> toggleLike(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long diaryId
    ) {
        extractUserId(authHeader);
        diaryService.toggleLike(diaryId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/sync")
        public ResponseEntity<Void> syncTransactions(
                @RequestHeader("Authorization") String authHeader
        ) {
            Long userId = extractUserId(authHeader);
            diaryService.syncTransactions(userId);
            return ResponseEntity.ok().build();
        }
    @GetMapping("/preview")
    public ResponseEntity<DiaryPreviewResponse> getDiaryPreview(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam Long groupId
    ) {
        Long userId = extractUserId(authHeader);  // extractUserId 결과 변수에 담기
        return ResponseEntity.ok(diaryService.getDiaryPreview(groupId, userId));  // userId 전달
    }

    @GetMapping("/preview/batch")
    public ResponseEntity<DiaryPreviewBatchResponse> getDiaryPreviewBatch(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam String groupIds
    ) {
        Long userId = extractUserId(authHeader);
        List<Long> ids = Arrays.stream(groupIds.split(","))
                .map(String::trim)
                .map(Long::parseLong)
                .collect(Collectors.toList());
        return ResponseEntity.ok(new DiaryPreviewBatchResponse(diaryService.getDiaryPreviewBatch(ids, userId)));
    }

    @GetMapping("/my-list")
    public ResponseEntity<List<DiaryFeedItemResponse>> getMyDiaryList(
            @RequestHeader("Authorization") String authHeader
    ) {
        Long userId = extractUserId(authHeader);
        return ResponseEntity.ok(diaryService.getMyDiaryList(userId));
    }
}