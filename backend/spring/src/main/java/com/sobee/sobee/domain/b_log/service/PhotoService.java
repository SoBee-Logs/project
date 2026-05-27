package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.dto.PhotoListResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoUploadRequest;
import com.sobee.sobee.domain.b_log.dto.PhotoUploadResponse;
import com.sobee.sobee.domain.b_log.dto.PhotoVlmResultRequest;
import com.sobee.sobee.domain.b_log.dto.PhotoVlmResultResponse;
import com.sobee.sobee.domain.b_log.entity.EmotionsText;
import com.sobee.sobee.domain.b_log.entity.MoodType;
import com.sobee.sobee.domain.b_log.entity.PersonaTransaction;
import com.sobee.sobee.domain.b_log.entity.Photo;
import com.sobee.sobee.domain.b_log.entity.PhotoGroups;
import com.sobee.sobee.domain.b_log.entity.PhotoGroupsId;
import com.sobee.sobee.domain.b_log.entity.PhotoMetadata;
import com.sobee.sobee.domain.b_log.entity.PhotoVlmResult;
import com.sobee.sobee.domain.b_log.entity.Transaction;
import com.sobee.sobee.domain.b_log.repository.EmotionsTextRepository;
import com.sobee.sobee.domain.b_log.repository.PersonaTransactionRepository;
import com.sobee.sobee.domain.b_log.repository.PhotoGroupsRepository;
import com.sobee.sobee.domain.b_log.repository.PhotoMetadataRepository;
import com.sobee.sobee.domain.b_log.repository.PhotoRepository;
import com.sobee.sobee.domain.b_log.repository.PhotoVlmResultRepository;
import com.sobee.sobee.domain.b_log.repository.TransactionRepository;
import com.sobee.sobee.global.s3.S3Uploader;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PhotoService {

    private final PhotoRepository photoRepository;
    private final PhotoMetadataRepository photoMetadataRepository;
    private final EmotionsTextRepository emotionsTextRepository;
    private final PhotoGroupsRepository photoGroupsRepository;
    private final S3Uploader s3Uploader;
    private final PhotoVlmResultRepository photoVlmResultRepository;
    private final PersonaTransactionRepository personaTransactionRepository;
    private final TransactionRepository transactionRepository;

    private static final DateTimeFormatter TAKEN_AT_FORMATTER = new DateTimeFormatterBuilder()
            .append(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            .optionalStart().appendOffsetId().optionalEnd()
            .toFormatter();

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("HH:mm");

    private LocalDateTime parseTakenAt(String takenAt) {
        try {
            return LocalDateTime.parse(takenAt, TAKEN_AT_FORMATTER);
        } catch (Exception e) {
            return LocalDateTime.parse(takenAt.replace("Z", "").replaceAll("\\.\\d+$", ""));
        }
    }

    @Transactional
    public PhotoUploadResponse uploadPhoto(PhotoUploadRequest request, Long userId) {

        if (request.getLatitude() == null || request.getLongitude() == null || request.getTakenAt() == null) {
            throw new IllegalArgumentException("사진 메타데이터가 없습니다. 다시 촬영해주세요.");
        }

        String imageUrl = s3Uploader.upload(request.getImage());

        Photo photo = Photo.builder()
                .userId(userId)
                .imageUrl(imageUrl)
                .fileName(request.getImage().getOriginalFilename())
                .build();
        photoRepository.save(photo);

        LocalDateTime takenAt = parseTakenAt(request.getTakenAt());
        PhotoMetadata metadata = PhotoMetadata.builder()
                .photo(photo)
                .takenAt(takenAt)
                .latitude(BigDecimal.valueOf(request.getLatitude()))
                .longitude(BigDecimal.valueOf(request.getLongitude()))
                .build();
        photoMetadataRepository.save(metadata);

        if (request.getText() != null || request.getEmoji() != null) {
            MoodType moodType = null;
            if (request.getEmoji() != null) {
                moodType = MoodType.valueOf(request.getEmoji());
            }
            EmotionsText emotionsText = EmotionsText.builder()
                    .photo(photo)
                    .text(request.getText())
                    .emoji(moodType)
                    .build();
            emotionsTextRepository.save(emotionsText);
        }

        if (request.getGroupId() != null && !request.getGroupId().isEmpty()) {
            for (Long groupId : request.getGroupId()) {
                PhotoGroups photoGroups = PhotoGroups.builder()
                        .id(new PhotoGroupsId(photo.getPhotoId(), groupId))
                        .photo(photo)
                        .build();
                photoGroupsRepository.save(photoGroups);
            }
        }

        return PhotoUploadResponse.builder()
                .photoId(photo.getPhotoId())
                .imageUrl(imageUrl)
                .takenAt(takenAt)
                .createdAt(photo.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public PhotoListResponse getPhotosByDate(Long userId, LocalDate date) {

        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();

        List<Photo> photos = photoRepository.findByUserIdAndDate(userId, startOfDay, endOfDay);

        List<PhotoResponse> responses = photos.stream().map(photo -> {

            // takenAt, date, time 추출
            PhotoMetadata metadata = photoMetadataRepository.findByPhoto(photo).orElse(null);
            String photoDate = metadata != null
                    ? metadata.getTakenAt().format(DATE_FORMATTER) : "";
            String photoTime = metadata != null
                    ? metadata.getTakenAt().format(TIME_FORMATTER) : "";

            // emoji, text 추출
            EmotionsText emotionsText = emotionsTextRepository.findByPhoto(photo).orElse(null);
            String emoji = emotionsText != null && emotionsText.getEmoji() != null
                    ? emotionsText.getEmoji().getEmoji() : null;
            String text = emotionsText != null ? emotionsText.getText() : null;

            // group 목록 추출
            List<Long> groupIds = photoGroupsRepository.findByPhoto(photo)
                    .stream()
                    .map(pg -> pg.getId().getGroupId())
                    .collect(Collectors.toList());

            // persona_transaction 테이블에 해당 사진의 결제 매핑 레코드가 있는지 확인
            boolean mapped = personaTransactionRepository.existsByPhotoId(photo.getPhotoId());

            return PhotoResponse.builder()
                    .id(photo.getPhotoId())
                    .url(photo.getImageUrl())
                    .date(photoDate)
                    .time(photoTime)
                    .emoji(emoji)
                    .text(text)
                    .group(groupIds)
                    .mapped(mapped)
                    .build();

        }).collect(Collectors.toList());

        return PhotoListResponse.builder()
                .photos(responses)
                .build();
    }

    // 특정 그룹의 가장 최신 사진 URL 반환 — 홈 피드 미리보기에 사용
    @Transactional(readOnly = true)
    public String getLatestPhotoUrlByGroup(Long groupId) {
        List<PhotoGroups> pgList = photoGroupsRepository.findByIdGroupId(groupId);
        return pgList.stream()
                .filter(pg -> pg.getPhoto() != null && pg.getPhoto().getCreatedAt() != null)
                .max(Comparator.comparing(pg -> pg.getPhoto().getCreatedAt()))
                .map(pg -> pg.getPhoto().getImageUrl())
                .orElse(null);
    }

    // VLM 분석 결과를 photo_vlm_results에 저장하고, transactions과 매핑해 persona_transaction에 저장
    @Transactional
    public PhotoVlmResultResponse saveVlmResult(Long photoId, Long userId, PhotoVlmResultRequest request) {

        // VLM 분석 결과 저장
        PhotoVlmResult vlmResult = PhotoVlmResult.builder()
                .photoId(photoId)
                .vlmCategory(request.getCategory())
                .vlmItemName(request.getItem_name())
                .vlmPriceEstimate(request.getPrice() != null
                        ? BigDecimal.valueOf(request.getPrice()) : null)
                .vlmStoreType(request.getLocation_type())
                .vlmStoreName(request.getStore_name())
                .vlmDescription(request.getDescription())
                .vlmConfidence(request.getConfidence() != null ? request.getConfidence() : "low")
                .vlmAddress(request.getAddress())
                .build();
        photoVlmResultRepository.save(vlmResult);

        // 결제 내역 매핑 시도 — VLM의 실제 촬영 일시를 함께 전달
        String matchedPaymentId = matchTransaction(photoId, userId, vlmResult, request.getTaken_at());

        return PhotoVlmResultResponse.builder()
                .vlmId(vlmResult.getVlmId())
                .photoId(photoId)
                .matched(matchedPaymentId != null)
                .matchedPaymentId(matchedPaymentId)
                .build();
    }

    // VLM의 실제 촬영 일시(EXIF) 또는 photo_metadata.taken_at 기준으로 결제 내역을 찾아 persona_transaction에 저장
    private String matchTransaction(Long photoId, Long userId, PhotoVlmResult vlmResult, String vlmTakenAt) {

        // ① VLM이 EXIF에서 추출한 실제 촬영 날짜를 우선 사용 (형식: "yyyy-MM-dd HH:mm:ss")
        LocalDate takenDate = null;
        if (vlmTakenAt != null && !vlmTakenAt.isBlank()) {
            try {
                takenDate = LocalDate.parse(
                        vlmTakenAt.trim().substring(0, 10),
                        DateTimeFormatter.ISO_LOCAL_DATE
                );
            } catch (Exception ignored) {
                // 파싱 실패 시 photo_metadata로 폴백
            }
        }

        // ② VLM 날짜 파싱 실패 시 photo_metadata.taken_at 폴백
        if (takenDate == null) {
            PhotoMetadata metadata = photoMetadataRepository
                    .findByPhotoPhotoId(photoId).orElse(null);
            if (metadata == null || metadata.getTakenAt() == null) return null;
            takenDate = metadata.getTakenAt().toLocalDate();
        }

        // 같은 날 해당 유저의 지출 내역 조회 (없으면 매핑 불가)
        // paymentDate 컬럼이 VARCHAR("yyyy-MM-dd")이므로 String으로 변환 후 전달
        String takenDateStr = takenDate.format(DATE_FORMATTER);
        List<Transaction> candidates = transactionRepository
                .findOutgoingByUserIdAndDate(userId, takenDateStr);
        if (candidates.isEmpty()) return null;

        Transaction best;

        if (vlmResult.getVlmPriceEstimate() != null) {
            // 가격 있을 때: 추정 가격과 실제 결제금액 차이가 가장 작은 내역 선택
            double estimatedPrice = vlmResult.getVlmPriceEstimate().doubleValue();

            best = candidates.stream()
                    .min(Comparator.comparingDouble(t ->
                            Math.abs(t.getPaymentOut() - estimatedPrice)))
                    .orElse(null);
            if (best == null) return null;

            // 차이가 추정 가격의 80% 초과면 매핑 신뢰도 낮으므로 skip
            double diff = Math.abs(best.getPaymentOut() - estimatedPrice);
            if (estimatedPrice > 0 && diff > estimatedPrice * 0.8) return null;

        } else {
            // 가격 없을 때: 같은 날 지출 내역 중 금액이 가장 큰 내역으로 매핑 (날짜 기반 폴백)
            best = candidates.stream()
                    .max(Comparator.comparingInt(Transaction::getPaymentOut))
                    .orElse(null);
            if (best == null) return null;
        }

        // persona_transaction에 매핑 결과 저장
        PersonaTransaction mapping = PersonaTransaction.builder()
                .vlmId(vlmResult.getVlmId())
                .photoId(photoId)
                .paymentId(best.getId().getPaymentId())
                .userId(userId)
                .build();
        personaTransactionRepository.save(mapping);

        return String.valueOf(best.getId().getPaymentId());
    }
}