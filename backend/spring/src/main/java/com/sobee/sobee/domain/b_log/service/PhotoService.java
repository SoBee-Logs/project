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
import java.util.Map;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestTemplate;

@Slf4j
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

    @Value("${fastapi.base-url}")
    private String fastapiBaseUrl;

    @Value("${fastapi.internal-secret}")
    private String internalSecret;

    private final RestTemplate restTemplate = new RestTemplate();

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

        // groups를 JSON 문자열로 변환
        String groupsJson = null;
        if (request.getGroups() != null) {
                try {
                groupsJson = new com.fasterxml.jackson.databind.ObjectMapper()
                        .writeValueAsString(request.getGroups());
                } catch (Exception e) {
                groupsJson = null;
                }
        }

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
                .vlmGroups(groupsJson)
                .isValid(request.getIs_valid() != null ? request.getIs_valid() : true)  // 추가
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
                .findFirstByPhotoIdOrderByVlmIdDesc(photoId).orElse(null);
        if (vlm == null) return;

        // 추가: 소비 아닌 사진 매핑 스킵
        if (Boolean.FALSE.equals(vlm.getIsValid())) {
                log.info("[매핑 스킵] 소비 아님 photoId={}", photoId);
                return;
        }
    
        PhotoMetadata metadata = photoMetadataRepository
                .findByPhotoPhotoId(photoId).orElse(null);
        if (metadata == null) return;
    
        LocalDateTime takenDateTime = metadata.getTakenAt() != null
                ? metadata.getTakenAt() : metadata.getCreatedAt();
        if (takenDateTime == null) return;
    
        String takenDateStr = takenDateTime.toLocalDate().format(DATE_FORMATTER);
        String takenAtStr = takenDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    
        List<Transaction> candidates = transactionRepository
                .findOutgoingByUserIdAndDate(userId, takenDateStr);
        if (candidates.isEmpty()) return;
    
        // 삭제: mappedIds 필터링 제거 — 날짜 기준 후보는 모두 포함
    
        // groups 파싱 — 없으면 vlm 정보로 group 1개 생성
        List<LlmMatchingClient.VlmGroupItem> groups = parseVlmGroups(vlm.getVlmGroups());
        if (groups.isEmpty()) {
            groups = List.of(LlmMatchingClient.VlmGroupItem.builder()
                    .group_id(1)
                    .store(vlm.getVlmStoreName())
                    .category(vlm.getVlmCategory())
                    .items(List.of(vlm.getVlmItemName() != null ? vlm.getVlmItemName() : ""))
                    .price(vlm.getVlmPriceEstimate() != null
                            ? vlm.getVlmPriceEstimate().doubleValue() : null)
                    .build());
        }
    
        String location = vlm.getVlmAddress() != null ? vlm.getVlmAddress() : "";
    
        LlmMatchingClient.MatchRequest req = LlmMatchingClient.MatchRequest.builder()
                .photo_id(photoId)
                .user_id(userId)
                .taken_at(takenAtStr)
                .location(location)
                .groups(groups)
                .candidates(candidates.stream()
                        .map(t -> LlmMatchingClient.TransactionCandidate.builder()
                                .payment_id(t.getId().getPaymentId())
                                .payment_out(t.getPaymentOut())
                                .payment_time(t.getPaymentDate() + " " + t.getPaymentTime())
                                .payment_place(t.getPaymentPlace())
                                .payment_category(t.getPaymentCategory())
                                .payment_address(t.getPaymentAddress())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    
        List<LlmMatchingClient.MatchResponse> results = llmMatchingClient.match(req);
    
        for (LlmMatchingClient.MatchResponse result : results) {
            if (result.getPayment_id() == null) {
                log.info("[매핑 실패] photoId={} groupId={} reason={}", photoId, result.getGroup_id(), result.getReason());
                continue;
            }

            if (personaTransactionRepository.existsByPhotoIdAndGroupId(photoId, result.getGroup_id())) continue;

            LlmMatchingClient.VlmGroupItem matchedGroup = groups.stream()
                    .filter(g -> g.getGroup_id() != null
                            && g.getGroup_id().equals(result.getGroup_id()))
                    .findFirst().orElse(null);

            PersonaTransaction mapping = PersonaTransaction.builder()
                    .vlmId(vlm.getVlmId())
                    .photoId(photoId)
                    .groupId(result.getGroup_id())
                    .groupStore(matchedGroup != null ? matchedGroup.getStore() : null)
                    .groupCategory(matchedGroup != null ? matchedGroup.getCategory() : null)
                    .groupPrice(matchedGroup != null && matchedGroup.getPrice() != null
                            ? BigDecimal.valueOf(matchedGroup.getPrice()) : null)
                    .paymentId(result.getPayment_id())
                    .userId(userId)
                    .build();

            log.info("[매핑 성공] photoId={} groupId={} paymentId={} reason={}", photoId, result.getGroup_id(), result.getPayment_id(), result.getReason());

            try {
                personaTransactionRepository.save(mapping);
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                log.warn("이미 매핑된 photo+group, skip: photoId={}, groupId={}", photoId, result.getGroup_id());
            }
        }
    }  // ← performMatchingForPhoto 닫는 중괄호 추가
    
    private List<LlmMatchingClient.VlmGroupItem> parseVlmGroups(String vlmGroupsJson) {
        if (vlmGroupsJson == null || vlmGroupsJson.isBlank()) return List.of();
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode arr = mapper.readTree(vlmGroupsJson);
            if (!arr.isArray()) return List.of();
    
            List<LlmMatchingClient.VlmGroupItem> result = new java.util.ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode node : arr) {
                List<String> items = new java.util.ArrayList<>();
                if (node.has("items") && node.get("items").isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode item : node.get("items")) {
                        items.add(item.asText());
                    }
                }
                result.add(LlmMatchingClient.VlmGroupItem.builder()
                        .group_id(node.has("group_id") ? node.get("group_id").asInt() : null)
                        .store(node.has("store") && !node.get("store").isNull()
                                ? node.get("store").asText() : null)
                        .category(node.has("category") ? node.get("category").asText() : null)
                        .items(items)
                        .price(node.has("price") ? node.get("price").asDouble() : null)
                        .build());
            }
            return result;
        } catch (Exception e) {
            return List.of();
        }
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
        @Transactional(readOnly = true)
        public List<Map<String, Object>> getMappingResult(Long photoId, Long userId) {
                List<PersonaTransaction> mappings = personaTransactionRepository.findByPhotoId(photoId);
        
                return mappings.stream().map(m -> {
                Map<String, Object> result = new java.util.LinkedHashMap<>();
                result.put("groupId", m.getGroupId());
                result.put("groupStore", m.getGroupStore());
                result.put("groupCategory", m.getGroupCategory());
                result.put("groupPrice", m.getGroupPrice());
                result.put("paymentId", m.getPaymentId());
        
                // 결제 상세 정보 조회
                transactionRepository.findByPaymentId(m.getPaymentId()).ifPresent(t -> {
                        result.put("paymentPlace", t.getPaymentPlace());
                        result.put("paymentOut", t.getPaymentOut());
                        result.put("paymentTime", t.getPaymentTime());
                });
        
                return result;
                }).collect(Collectors.toList());
        }

    public String getAiSummary(Long userId, LocalDate date) {
        try {
            String url = fastapiBaseUrl + "/internal/daily-summary?user_id=" + userId + "&date=" + date;
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Internal-Secret", internalSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            var response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Object summary = response.getBody().get("summary");
                return summary != null ? summary.toString() : "";
            }
        } catch (Exception e) {
            log.warn("[ai-summary] FastAPI 호출 실패: {}", e.getMessage());
        }
        return "";
    }

}