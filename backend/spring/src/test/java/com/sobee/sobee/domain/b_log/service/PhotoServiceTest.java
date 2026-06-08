package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.entity.*;
import com.sobee.sobee.domain.b_log.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PhotoServiceTest {

    @Mock PhotoVlmResultRepository photoVlmResultRepository;
    @Mock PhotoMetadataRepository photoMetadataRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock PersonaTransactionRepository personaTransactionRepository;
    @Mock LlmMatchingClient llmMatchingClient;

    @InjectMocks
    PhotoService photoService;

    @Test
    void VLM결과없으면_매핑스킵() {
        // given
        Long photoId = 1L;
        Long userId = 13L;
        when(photoVlmResultRepository.findFirstByPhotoIdOrderByVlmIdDesc(photoId))
                .thenReturn(Optional.empty());

        // when
        photoService.performMatchingForPhoto(photoId, userId);

        // then
        verify(llmMatchingClient, never()).match(any());
    }

    @Test
void 메타데이터없으면_매핑스킵() {
    // given
    Long photoId = 1L;
    Long userId = 13L;
    PhotoVlmResult vlm = PhotoVlmResult.builder()
            .vlmId(1L)
            .photoId(photoId)
            .vlmConfidence("high")
            .build();
    when(photoVlmResultRepository.findFirstByPhotoIdOrderByVlmIdDesc(photoId))
            .thenReturn(Optional.of(vlm));
    when(photoMetadataRepository.findByPhotoPhotoId(photoId))
            .thenReturn(Optional.empty());

    // when
    photoService.performMatchingForPhoto(photoId, userId);

    // then
    verify(llmMatchingClient, never()).match(any());
}

@Test
void 결제내역없으면_매핑스킵() {
    // given
    Long photoId = 1L;
    Long userId = 13L;

    PhotoVlmResult vlm = PhotoVlmResult.builder()
            .vlmId(1L)
            .photoId(photoId)
            .vlmConfidence("high")
            .build();

    PhotoMetadata metadata = PhotoMetadata.builder()
            .takenAt(LocalDateTime.of(2026, 5, 30, 18, 36, 51))
            .build();

    when(photoVlmResultRepository.findFirstByPhotoIdOrderByVlmIdDesc(photoId))
            .thenReturn(Optional.of(vlm));
    when(photoMetadataRepository.findByPhotoPhotoId(photoId))
            .thenReturn(Optional.of(metadata));
    when(transactionRepository.findOutgoingByUserIdAndDate(any(), any()))
            .thenReturn(List.of());

    // when
    photoService.performMatchingForPhoto(photoId, userId);

    // then
    verify(llmMatchingClient, never()).match(any());
}

@Test
void 이미매핑된결제만있으면_매핑스킵() {
    // given
    Long photoId = 1L;
    Long userId = 13L;

    PhotoVlmResult vlm = PhotoVlmResult.builder()
            .vlmId(1L)
            .photoId(photoId)
            .vlmConfidence("high")
            .build();

    PhotoMetadata metadata = PhotoMetadata.builder()
            .takenAt(LocalDateTime.of(2026, 5, 30, 18, 36, 51))
            .build();

    TransactionId txId = new TransactionId(5764L, 13L);
    Transaction tx = new Transaction(txId, 30000, 0, "옥자회관", "2026-05-30", "18:59:00", "일식", null);

    when(photoVlmResultRepository.findFirstByPhotoIdOrderByVlmIdDesc(photoId))
            .thenReturn(Optional.of(vlm));
    when(photoMetadataRepository.findByPhotoPhotoId(photoId))
            .thenReturn(Optional.of(metadata));
    when(transactionRepository.findOutgoingByUserIdAndDate(any(), any()))
            .thenReturn(List.of(tx));
    when(personaTransactionRepository.findPaymentIdsByUserId(userId))
            .thenReturn(List.of("5764"));  // 이미 매핑된 상태

    // when
    photoService.performMatchingForPhoto(photoId, userId);

    // then
    verify(llmMatchingClient, never()).match(any());
}
@Test
void 정상매핑성공() {
    // given
    Long photoId = 1L;
    Long userId = 13L;

    PhotoVlmResult vlm = PhotoVlmResult.builder()
            .vlmId(1L)
            .photoId(photoId)
            .vlmConfidence("high")
            .vlmCategory("요식업")
            .vlmItemName("돈까스")
            .vlmStoreName("옥자회관")
            .build();

    PhotoMetadata metadata = PhotoMetadata.builder()
            .takenAt(LocalDateTime.of(2026, 5, 30, 18, 36, 51))
            .build();

    TransactionId txId = new TransactionId(5764L, 13L);
    Transaction tx = new Transaction(txId, 30000, 0, "옥자회관", "2026-05-30", "18:59:00", "일식", null);

    LlmMatchingClient.MatchResponse matchResponse = new LlmMatchingClient.MatchResponse();
    matchResponse.setGroup_id(1);
    matchResponse.setPayment_id(5764L);
    matchResponse.setReason("가게명 일치");

    when(photoVlmResultRepository.findFirstByPhotoIdOrderByVlmIdDesc(photoId))
            .thenReturn(Optional.of(vlm));
    when(photoMetadataRepository.findByPhotoPhotoId(photoId))
            .thenReturn(Optional.of(metadata));
    when(transactionRepository.findOutgoingByUserIdAndDate(any(), any()))
            .thenReturn(List.of(tx));
    when(personaTransactionRepository.findPaymentIdsByUserId(userId))
            .thenReturn(List.of());
    when(llmMatchingClient.match(any()))
            .thenReturn(List.of(matchResponse));

    // when
    photoService.performMatchingForPhoto(photoId, userId);

    // then
    verify(llmMatchingClient, times(1)).match(any());
    verify(personaTransactionRepository, times(1)).save(any());
}

}