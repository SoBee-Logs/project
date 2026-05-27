package com.sobee.sobee.domain.b_log.controller;

import com.sobee.sobee.domain.b_log.dto.PhotoListResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoUploadRequest;
import com.sobee.sobee.domain.b_log.dto.PhotoUploadResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoVlmResultRequest;
import com.sobee.sobee.domain.b_log.dto.PhotoVlmResultResponse;
import com.sobee.sobee.domain.b_log.service.PhotoService;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/photos")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photoService;
    private final JwtUtil jwtUtil;

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("토큰이 없습니다.");
        }
        String token = authHeader.substring(7);
        return jwtUtil.getUserId(token);
    }

    @PostMapping
    public ResponseEntity<PhotoUploadResponse> uploadPhoto(
            @RequestHeader("Authorization") String authHeader,
            @RequestPart("image") MultipartFile image,
            @RequestPart("takenAt") String takenAt,
            @RequestPart("latitude") String latitude,
            @RequestPart("longitude") String longitude,
            @RequestPart(value = "text", required = false) String text,
            @RequestPart(value = "emoji", required = false) String emoji,
            @RequestPart(value = "groupId", required = false) String groupId
    ) {
        Long userId = extractUserId(authHeader);

        List<Long> groupIdList = null;
        if (groupId != null && !groupId.isEmpty()) {
            groupIdList = Arrays.stream(groupId.split(","))
                    .map(String::trim)
                    .map(Long::parseLong)
                    .collect(Collectors.toList());
        }

        PhotoUploadRequest request = PhotoUploadRequest.builder()
                .image(image)
                .takenAt(takenAt)
                .latitude(Double.valueOf(latitude))
                .longitude(Double.valueOf(longitude))
                .text(text)
                .emoji(emoji)
                .groupId(groupIdList)
                .build();

        PhotoUploadResponse response = photoService.uploadPhoto(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<PhotoListResponse> getPhotos(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam("date") String date
    ) {
        Long userId = extractUserId(authHeader);
        LocalDate localDate = LocalDate.parse(date);
        PhotoListResponse response = photoService.getPhotosByDate(userId, localDate);
        return ResponseEntity.ok(response);
    }

    // 특정 그룹의 가장 최신 사진 URL 반환 — 홈 피드 미리보기용
    @GetMapping("/group/{groupId}/latest")
    public ResponseEntity<Map<String, String>> getLatestPhotoByGroup(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long groupId
    ) {
        // 인증 확인 (userId는 현재 미사용, 향후 본인 사진만 필터링 시 활용 가능)
        extractUserId(authHeader);
        String imageUrl = photoService.getLatestPhotoUrlByGroup(groupId);
        Map<String, String> result = new HashMap<>();
        result.put("imageUrl", imageUrl);
        return ResponseEntity.ok(result);
    }

    // VLM 분석 결과 저장 + 결제 내역 매핑 — 프론트 CameraPage에서 호출
    @PostMapping("/{photoId}/vlm-result")
    public ResponseEntity<PhotoVlmResultResponse> saveVlmResult(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long photoId,
            @RequestBody PhotoVlmResultRequest request
    ) {
        Long userId = extractUserId(authHeader);
        PhotoVlmResultResponse response = photoService.saveVlmResult(photoId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}