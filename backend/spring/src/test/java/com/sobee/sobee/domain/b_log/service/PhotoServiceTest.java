package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.dto.PhotoUploadRequest;
import com.sobee.sobee.domain.b_log.dto.PhotoUploadResponse;
import com.sobee.sobee.domain.b_log.entity.Photo;
import com.sobee.sobee.domain.b_log.entity.PhotoMetadata;
import com.sobee.sobee.domain.b_log.repository.*;
import com.sobee.sobee.global.s3.S3Uploader;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PhotoServiceTest {

    @Mock private PhotoRepository photoRepository;
    @Mock private PhotoMetadataRepository photoMetadataRepository;
    @Mock private EmotionsTextRepository emotionsTextRepository;
    @Mock private PhotoGroupsRepository photoGroupsRepository;
    @Mock private PhotoVlmResultRepository photoVlmResultRepository;
    @Mock private PersonaTransactionRepository personaTransactionRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private LlmMatchingClient llmMatchingClient;
    @Mock private S3Uploader s3Uploader;

    @InjectMocks
    private PhotoService photoService;

    @Test
@DisplayName("정상적인 사진 업로드 성공")
void uploadPhoto_success() {
    // given
    MockMultipartFile image = new MockMultipartFile(
            "image", "test.jpg", "image/jpeg", "fake-image".getBytes());

    PhotoUploadRequest request = PhotoUploadRequest.builder()
            .image(image)
            .takenAt("2026-06-02T18:36:03")
            .latitude(37.5)
            .longitude(126.9)
            .build();

    Photo savedPhoto = Photo.builder()
            .photoId(1L)
            .userId(13L)
            .imageUrl("https://s3.amazonaws.com/test.jpg")
            .createdAt(LocalDateTime.now())  // 추가
            .isValid(true)                   // 추가
            .build();

    when(s3Uploader.upload(any())).thenReturn("https://s3.amazonaws.com/test.jpg");
    when(photoRepository.save(any())).thenReturn(savedPhoto);
    when(photoMetadataRepository.save(any())).thenReturn(mock(PhotoMetadata.class));

    // when
    PhotoUploadResponse response = photoService.uploadPhoto(request, 13L);

    // then
    assertThat(response.getPhotoId()).isEqualTo(1L);
    assertThat(response.getImageUrl()).isEqualTo("https://s3.amazonaws.com/test.jpg");
    verify(photoRepository, times(1)).save(any());
    verify(photoMetadataRepository, times(1)).save(any());
    verify(s3Uploader, times(1)).upload(any());
}

@Test
@DisplayName("메타데이터 없으면 업로드 실패")
void uploadPhoto_fail_noMetadata() {
    // given
    MockMultipartFile image = new MockMultipartFile(
            "image", "test.jpg", "image/jpeg", "fake-image".getBytes());

    PhotoUploadRequest request = PhotoUploadRequest.builder()
            .image(image)
            .takenAt(null)
            .latitude(null)
            .longitude(null)
            .build();

    // when & then
    assertThatThrownBy(() -> photoService.uploadPhoto(request, 13L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("사진 메타데이터가 없습니다. 다시 촬영해주세요.");
}
}