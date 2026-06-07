package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.dto.PhotoUploadRequest;
import com.sobee.sobee.domain.b_log.repository.*;
import com.sobee.sobee.domain.b_log.service.LlmMatchingClient;
import com.sobee.sobee.domain.b_log.service.PhotoService;
import com.sobee.sobee.global.s3.S3Uploader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class PhotoServiceTest {

    @Mock private PhotoRepository photoRepository;
    @Mock private PhotoMetadataRepository photoMetadataRepository;
    @Mock private EmotionsTextRepository emotionsTextRepository;
    @Mock private PhotoGroupsRepository photoGroupsRepository;
    @Mock private PhotoVlmResultRepository photoVlmResultRepository;
    @Mock private PersonaTransactionRepository personaTransactionRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private S3Uploader s3Uploader;
    @Mock private LlmMatchingClient llmMatchingClient;

    @InjectMocks
    private PhotoService photoService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    // 1. 메타데이터 없으면 예외 발생
    @Test
    void 메타데이터_없으면_예외발생() {
        PhotoUploadRequest request = PhotoUploadRequest.builder()
                .image(new MockMultipartFile("image", "test.jpg", "image/jpeg", "dummy".getBytes()))
                .takenAt(null)
                .latitude(null)
                .longitude(null)
                .build();

        assertThatThrownBy(() -> photoService.uploadPhoto(request, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("메타데이터");
    }

    // 2. S3 업로드 후 사진 저장
    @Test
    void S3_업로드_후_사진저장() {
        when(s3Uploader.upload(any())).thenReturn("http://s3.test.com/img.jpg");
        when(photoRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(photoMetadataRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        PhotoUploadRequest request = PhotoUploadRequest.builder()
                .image(new MockMultipartFile("image", "test.jpg", "image/jpeg", "dummy".getBytes()))
                .takenAt("2026-06-07T14:30:00")
                .latitude(37.5665)
                .longitude(126.9780)
                .build();

        var response = photoService.uploadPhoto(request, 1L);

        assertThat(response.getImageUrl()).isEqualTo("http://s3.test.com/img.jpg");
    }
}
