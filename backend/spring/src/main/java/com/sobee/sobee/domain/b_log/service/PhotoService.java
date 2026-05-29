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
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
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

        // VLM이 EXIF에서 추출한 실제 촬영 시각이 있으면 photo_metadata.taken_at 업데이트
        if (request.getTaken_at() != null && !request.getTaken_at().isBlank()) {
            photoMetadataRepository.findByPhotoPhotoId(photoId).ifPresent(metadata -> {
                try {
                    String normalized = request.getTaken_at().trim().substring(0, 19);
                    LocalDateTime exifTime = LocalDateTime.parse(normalized,
                            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                    metadata.setTakenAt(exifTime);
                    photoMetadataRepository.save(metadata);
                } catch (Exception ignored) {}
            });
        }

        // 매핑은 일기 생성 시점으로 지연 (결제 데이터 동기화 완료 후 매핑)
        return PhotoVlmResultResponse.builder()
                .vlmId(vlmResult.getVlmId())
                .photoId(photoId)
                .build();
    }

    // DiaryService가 일기 생성 시점에 호출 — 미매핑 사진 1건 매핑 시도
    public void performMatchingForPhoto(Long photoId, Long userId) {
        PhotoVlmResult vlm = photoVlmResultRepository
                .findFirstByPhotoIdOrderByVlmIdDesc(photoId)
                .orElse(null);
        if (vlm == null) return;
        // photo_metadata.taken_at이 saveVlmResult에서 EXIF 시간으로 이미 업데이트됨
        // taken_at null이면 matchTransaction 내부에서 created_at으로 폴백
        matchTransaction(photoId, userId, vlm, null);
    }

    // VLM의 실제 촬영 일시(EXIF) 또는 photo_metadata.taken_at 기준으로 결제 내역을 찾아 persona_transaction에 저장
    private String matchTransaction(Long photoId, Long userId, PhotoVlmResult vlmResult, String vlmTakenAt) {

        // ① 촬영 일시 결정 — takenDateTime(LocalDateTime) 및 takenDate(LocalDate) 동시 획득
        LocalDateTime takenDateTime = null;
        LocalDate takenDate = null;

        if (vlmTakenAt != null && !vlmTakenAt.isBlank()) {
            try {
                String normalized = vlmTakenAt.trim().substring(0, 19);
                takenDateTime = LocalDateTime.parse(normalized,
                        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                takenDate = takenDateTime.toLocalDate();
            } catch (Exception ignored) {
                // 파싱 실패 시 photo_metadata로 폴백
            }
        }

        if (takenDateTime == null) {
            PhotoMetadata metadata = photoMetadataRepository
                    .findByPhotoPhotoId(photoId).orElse(null);
            if (metadata == null) return null;
            // 1순위: taken_at (EXIF 촬영 시간), 2순위: created_at (업로드 시간)
            takenDateTime = metadata.getTakenAt() != null
                    ? metadata.getTakenAt()
                    : metadata.getCreatedAt();
            if (takenDateTime == null) return null;
            takenDate = takenDateTime.toLocalDate();
        }

        // ② 같은 날 해당 유저의 지출 내역 조회
        String takenDateStr = takenDate.format(DATE_FORMATTER);
        List<Transaction> candidates = transactionRepository
                .findOutgoingByUserIdAndDate(userId, takenDateStr);
        if (candidates.isEmpty()) return null;

        // ③ 이미 매핑된 paymentId 후보에서 제거 (1:1 강제 매핑)
        Set<String> mappedIds = Set.copyOf(personaTransactionRepository.findPaymentIdsByUserId(userId));
        List<Transaction> available = candidates.stream()
                .filter(t -> !mappedIds.contains(String.valueOf(t.getId().getPaymentId())))
                .collect(Collectors.toList());
        if (available.isEmpty()) return null;

        // ④ 가격 기반 매핑
        Transaction best = null;

        if (vlmResult.getVlmPriceEstimate() != null) {
            double estimatedPrice = vlmResult.getVlmPriceEstimate().doubleValue();
            Transaction priceBest = available.stream()
                    .min(Comparator.comparingDouble(t ->
                            Math.abs(t.getPaymentOut() - estimatedPrice)))
                    .orElse(null);
            if (priceBest != null) {
                double diff = Math.abs(priceBest.getPaymentOut() - estimatedPrice);
                if (estimatedPrice <= 0 || diff <= estimatedPrice * 0.8) {
                    best = priceBest;
                }
                // diff > 80%면 best = null → 시간 기반 폴백으로 넘어감
            }
        }

        // ⑤ 시간 기반 폴백 — ±2시간 이내 가장 시간차 적은 결제 내역 선택
        if (best == null) {
            final LocalDateTime photoTime = takenDateTime;
            final LocalDate photoDate = takenDate;
            best = available.stream()
                    .filter(t -> {
                        if (t.getPaymentTime() == null || t.getPaymentTime().isBlank()) return false;
                        try {
                            LocalTime txTime = LocalTime.parse(
                                    t.getPaymentTime().trim().substring(0, 5),
                                    DateTimeFormatter.ofPattern("HH:mm"));
                            LocalDateTime txDateTime = photoDate.atTime(txTime);
                            return Math.abs(Duration.between(photoTime, txDateTime).toMinutes()) <= 120;
                        } catch (Exception e) {
                            return false;
                        }
                    })
                    .min(Comparator.comparingLong(t -> {
                        try {
                            LocalTime txTime = LocalTime.parse(
                                    t.getPaymentTime().trim().substring(0, 5),
                                    DateTimeFormatter.ofPattern("HH:mm"));
                            LocalDateTime txDateTime = photoDate.atTime(txTime);
                            return Math.abs(Duration.between(photoTime, txDateTime).toMinutes());
                        } catch (Exception e) {
                            return Long.MAX_VALUE;
                        }
                    }))
                    .orElse(null);
            if (best == null) return null;
        }

        // ⑥ persona_transaction에 매핑 결과 저장
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