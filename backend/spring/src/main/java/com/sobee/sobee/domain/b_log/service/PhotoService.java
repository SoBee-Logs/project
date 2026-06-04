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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    private final LlmMatchingClient llmMatchingClient;

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
            OffsetDateTime odt = OffsetDateTime.parse(takenAt, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            return odt.withOffsetSameInstant(ZoneOffset.ofHours(9)).toLocalDateTime();
        } catch (Exception e) {
            String cleaned = takenAt.replace("Z", "").replaceAll("\\.\\d+$", "");
            try {
                return LocalDateTime.parse(cleaned, TAKEN_AT_FORMATTER);
            } catch (Exception e2) {
                return LocalDateTime.parse(cleaned);
            }
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

        photo = photoRepository.save(photo);

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

            PhotoMetadata metadata = photoMetadataRepository.findByPhoto(photo).orElse(null);
            String photoDate = metadata != null
                    ? metadata.getTakenAt().format(DATE_FORMATTER) : "";
            String photoTime = metadata != null
                    ? metadata.getTakenAt().format(TIME_FORMATTER) : "";

            EmotionsText emotionsText = emotionsTextRepository.findByPhotoId(photo.getPhotoId()).orElse(null);
            String emoji = emotionsText != null && emotionsText.getEmoji() != null
                    ? emotionsText.getEmoji().getEmoji() : null;
            String text = emotionsText != null ? emotionsText.getText() : null;

            List<Long> groupIds = photoGroupsRepository.findByPhoto(photo)
                    .stream()
                    .map(pg -> pg.getId().getGroupId())
                    .collect(Collectors.toList());

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

    @Transactional(readOnly = true)
    public String getLatestPhotoUrlByGroup(Long groupId) {
        List<PhotoGroups> pgList = photoGroupsRepository.findByIdGroupId(groupId);
        return pgList.stream()
                .filter(pg -> pg.getPhoto() != null && pg.getPhoto().getCreatedAt() != null)
                .max(Comparator.comparing(pg -> pg.getPhoto().getCreatedAt()))
                .map(pg -> pg.getPhoto().getImageUrl())
                .orElse(null);
    }

    @Transactional
    public PhotoVlmResultResponse saveVlmResult(Long photoId, Long userId, PhotoVlmResultRequest request) {

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

        if (request.getTaken_at() != null && !request.getTaken_at().isBlank()) {
            photoMetadataRepository.findByPhotoPhotoId(photoId).ifPresent(metadata -> {
                try {
                    LocalDateTime exifTime = parseExifDateTime(request.getTaken_at());
                    metadata.setTakenAt(exifTime);
                    photoMetadataRepository.save(metadata);
                } catch (Exception ignored) {}
            });
        }

        return PhotoVlmResultResponse.builder()
                .vlmId(vlmResult.getVlmId())
                .photoId(photoId)
                .build();
    }

    public void performMatchingForPhoto(Long photoId, Long userId) {
        PhotoVlmResult vlm = photoVlmResultRepository
                .findFirstByPhotoIdOrderByVlmIdDesc(photoId)
                .orElse(null);
        if (vlm == null) return;

        PhotoMetadata metadata = photoMetadataRepository
                .findByPhotoPhotoId(photoId).orElse(null);
        if (metadata == null) return;

        LocalDateTime takenDateTime = metadata.getTakenAt() != null
                ? metadata.getTakenAt()
                : metadata.getCreatedAt();
        if (takenDateTime == null) return;

        String takenDateStr = takenDateTime.toLocalDate().format(DATE_FORMATTER);

        List<Transaction> candidates = transactionRepository
                .findOutgoingByUserIdAndDate(userId, takenDateStr);
        if (candidates.isEmpty()) return;

        Set<String> mappedIds = Set.copyOf(
                personaTransactionRepository.findPaymentIdsByUserId(userId));
        List<Transaction> available = candidates.stream()
                .filter(t -> !mappedIds.contains(String.valueOf(t.getId().getPaymentId())))
                .collect(Collectors.toList());
        if (available.isEmpty()) return;

        LlmMatchingClient.MatchRequest req = LlmMatchingClient.MatchRequest.builder()
                .photo_id(photoId)
                .user_id(userId)
                .vlm_data(LlmMatchingClient.VlmData.builder()
                        .category(vlm.getVlmCategory())
                        .item_name(vlm.getVlmItemName())
                        .price_estimate(vlm.getVlmPriceEstimate() != null
                                ? vlm.getVlmPriceEstimate().doubleValue() : null)
                        .store_type(vlm.getVlmStoreType())
                        .store_name(vlm.getVlmStoreName())
                        .description(vlm.getVlmDescription())
                        .taken_at(takenDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                        .latitude(metadata.getLatitude() != null
                                ? metadata.getLatitude().doubleValue() : null)
                        .longitude(metadata.getLongitude() != null
                                ? metadata.getLongitude().doubleValue() : null)
                        .build())
                .candidates(available.stream()
                        .map(t -> LlmMatchingClient.TransactionCandidate.builder()
                                .payment_id(t.getId().getPaymentId())
                                .payment_out(t.getPaymentOut())
                                .payment_time(t.getPaymentTime())
                                .payment_place(t.getPaymentPlace())
                                .payment_category(t.getPaymentCategory())
                                .payment_address(t.getPaymentAddress())
                                .build())
                        .collect(Collectors.toList()))
                .build();

        Long matchedPaymentId = llmMatchingClient.match(req);
        if (matchedPaymentId == null) return;

        PersonaTransaction mapping = PersonaTransaction.builder()
                .vlmId(vlm.getVlmId())
                .photoId(photoId)
                .paymentId(matchedPaymentId)
                .userId(userId)
                .build();
        personaTransactionRepository.save(mapping);
    }

    private LocalDateTime parseExifDateTime(String raw) {
        String normalized = raw.trim().substring(0, 19);
        LocalDateTime ldt = LocalDateTime.parse(normalized,
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        if (raw.trim().length() > 19) {
            try {
                ZoneOffset offset = ZoneOffset.of(raw.trim().substring(19).trim());
                return ldt.atOffset(offset)
                        .withOffsetSameInstant(ZoneOffset.ofHours(9))
                        .toLocalDateTime();
            } catch (Exception ignored) {}
        }
        return ldt;
    }
}