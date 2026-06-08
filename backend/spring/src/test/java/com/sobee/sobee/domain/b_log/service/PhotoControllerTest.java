package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.controller.PhotoController;
import com.sobee.sobee.domain.b_log.dto.PhotoListResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoUploadResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoVlmResultResponse;
import com.sobee.sobee.domain.b_log.service.PhotoService;
import com.sobee.sobee.global.jwt.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class PhotoControllerTest {

    @Mock
    private PhotoService photoService;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private PhotoController photoController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(jwtUtil.getUserId(any())).thenReturn(1L);
    }

    // 1. 사진 업로드 성공
    @Test
    void 사진_업로드_성공() {
        MockMultipartFile image = new MockMultipartFile(
                "image", "test.jpg", "image/jpeg", "dummy".getBytes()
        );
        when(photoService.uploadPhoto(any(), anyLong()))
                .thenReturn(PhotoUploadResponse.builder()
                        .photoId(1L)
                        .imageUrl("http://test.com/img.jpg")
                        .takenAt(LocalDateTime.now())
                        .createdAt(LocalDateTime.now())
                        .build());

        ResponseEntity<PhotoUploadResponse> response = photoController.uploadPhoto(
                "Bearer fake-token", image,
                "2026-06-07T14:30:00", "37.5665", "126.9780",
                "테스트", "HAPPY", "1"
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getPhotoId()).isEqualTo(1L);
    }

    // 2. 텍스트 50자 초과 시 400 반환
    @Test
    void 텍스트_50자_초과시_400반환() {
        MockMultipartFile image = new MockMultipartFile(
                "image", "test.jpg", "image/jpeg", "dummy".getBytes()
        );
        String longText = "a".repeat(51);

        ResponseEntity<PhotoUploadResponse> response = photoController.uploadPhoto(
                "Bearer fake-token", image,
                "2026-06-07T14:30:00", "37.5665", "126.9780",
                longText, "HAPPY", "1"
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // 3. 날짜별 사진 조회 성공
    @Test
    void 날짜별_사진_조회_성공() {
        when(photoService.getPhotosByDate(anyLong(), any()))
                .thenReturn(PhotoListResponse.builder()
                        .photos(List.of())
                        .build());

        ResponseEntity<PhotoListResponse> response = photoController.getPhotos(
                "Bearer fake-token", "2026-06-07"
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getPhotos()).isEmpty();
    }

    // 4. VLM 결과 저장 성공
    @Test
    void VLM_결과_저장_성공() {
        when(photoService.saveVlmResult(anyLong(), anyLong(), any()))
                .thenReturn(PhotoVlmResultResponse.builder()
                        .vlmId(1L)
                        .photoId(1L)
                        .build());

        ResponseEntity<PhotoVlmResultResponse> response = photoController.saveVlmResult(
                "Bearer fake-token", 1L, null
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getPhotoId()).isEqualTo(1L);
    }
}