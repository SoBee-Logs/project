package com.sobee.sobee.domain.b_log.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sobee.sobee.domain.b_log.dto.DiaryFeedItemResponse;
import com.sobee.sobee.domain.b_log.dto.DiaryGenerateRequest;
import com.sobee.sobee.domain.b_log.dto.DiaryGenerateResponse;
import com.sobee.sobee.domain.b_log.dto.DiaryPreviewResponse;
import com.sobee.sobee.domain.b_log.dto.DiarySaveRequest;
import com.sobee.sobee.domain.b_log.entity.*;
import com.sobee.sobee.domain.b_log.repository.*;
import com.sobee.sobee.domain.group.entity.Group;
import com.sobee.sobee.domain.group.repository.GroupRepository;
import com.sobee.sobee.domain.user.entity.User;
import com.sobee.sobee.domain.user.repository.UserRepository;
import lombok.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiaryService {

    private final GroupRepository groupRepository;
    private final PhotoGroupsRepository photoGroupsRepository;
    private final EmotionsTextRepository emotionsTextRepository;
    private final PhotoVlmResultRepository photoVlmResultRepository;
    private final PersonaTransactionRepository personaTransactionRepository;
    private final DiaryRepository diaryRepository;
    private final DiaryPhotoRepository diaryPhotoRepository;
    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final TransactionRepository transactionRepository;

    @Value("${fastapi.base-url}/api/diary/generate")
    private String fastapiDiaryUrl;

    @Value("${fastapi.base-url}/internal/transactions/sync")
    private String fastapiSyncUrl;

    @Value("${fastapi.base-url}/internal/vlm-category-fallback")
    private String fastapiVlmFallbackUrl;

    @Value("${fastapi.internal-secret}")
    private String internalSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    @Transactional
    public DiaryGenerateResponse generateDiary(DiaryGenerateRequest req, Long userId) {

        Group group = groupRepository.findById(req.getGroupId())
                .orElseThrow(() -> new RuntimeException("모임방을 찾을 수 없습니다. groupId=" + req.getGroupId()));

        LocalDate targetDate = LocalDate.parse(req.getDate(), DateTimeFormatter.ISO_LOCAL_DATE);

        List<PhotoGroups> pgList = photoGroupsRepository.findByIdGroupId(req.getGroupId());

        // 오늘 날짜 + 본인 사진 필터
        List<Photo> todayPhotos = pgList.stream()
                .map(PhotoGroups::getPhoto)
                .filter(photo -> photo.getUserId().equals(userId))
                .filter(photo -> photo.getCreatedAt() != null
                        && photo.getCreatedAt().toLocalDate().equals(targetDate))
                .sorted(Comparator.comparing(Photo::getCreatedAt).reversed())
                .collect(Collectors.toList());

        // 사진 없으면 일기 생성 차단
        if (todayPhotos.isEmpty()) {
            throw new IllegalArgumentException("이 모임방에 등록된 사진이 없어 일기를 생성할 수 없습니다.");
        }

        // 매핑된 사진만 따로 필터링 (LLM 일기 생성용)
        List<Photo> matchedPhotos = todayPhotos.stream()
                .filter(photo -> personaTransactionRepository.existsByPhotoId(photo.getPhotoId()))
                .collect(Collectors.toList());

        // 일기 생성에 사용할 사진 = 매핑된 사진 우선, 없으면 빈 리스트 (방소개로만 생성)
        List<Photo> photosForDiary = matchedPhotos.isEmpty() ? Collections.emptyList() : matchedPhotos;

        List<String> imageUrls = todayPhotos.stream()
                .map(Photo::getImageUrl)
                .collect(Collectors.toList());
        List<Long> photoIds = todayPhotos.stream()
                .map(Photo::getPhotoId)
                .collect(Collectors.toList());
        List<Long> matchedPhotoIds = matchedPhotos.stream()
                .map(Photo::getPhotoId)
                .collect(Collectors.toList());

        // VLM 결과 수집 (전체 사진 기준 — 미매핑 사진 description도 반영)
        List<PhotoVlmResult> allVlms = todayPhotos.stream()
                .map(p -> photoVlmResultRepository
                        .findFirstByPhotoIdOrderByVlmIdDesc(p.getPhotoId())
                        .orElse(null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        // 매핑된 사진 기준 VLM (item_name, store_name, category, price용)
        List<PhotoVlmResult> matchedVlms = photosForDiary.stream()
                .map(p -> photoVlmResultRepository
                        .findFirstByPhotoIdOrderByVlmIdDesc(p.getPhotoId())
                        .orElse(null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        String combinedItemName = matchedVlms.stream()
                .map(PhotoVlmResult::getVlmItemName)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));

        // description은 전체 사진 기준
        String combinedDescription = allVlms.stream()
                .map(PhotoVlmResult::getVlmDescription)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(" / "));

        String combinedCategory = matchedVlms.stream()
                .map(PhotoVlmResult::getVlmCategory)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.joining(", "));

        Integer actualPrice = matchedPhotos.stream()
                .flatMap(p -> personaTransactionRepository.findByPhotoId(p.getPhotoId()).stream())
                .mapToInt(pt -> transactionRepository.findByPaymentId(pt.getPaymentId())
                        .map(t -> t.getPaymentOut() != null ? t.getPaymentOut() : 0)
                        .orElse(0))
                .sum();

        String combinedStoreName = matchedVlms.stream()
                .map(PhotoVlmResult::getVlmStoreName)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.joining(", "));

        // 감정 데이터 — 전체 수집 후 텍스트 합치기
        List<EmotionsText> allEmotions = todayPhotos.stream()
                .map(p -> emotionsTextRepository.findByPhotoId(p.getPhotoId()).orElse(null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        String combinedEmotionText = allEmotions.stream()
                .map(EmotionsText::getText)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));

        String moodEmoji = allEmotions.stream()
                .map(EmotionsText::getEmoji)
                .filter(Objects::nonNull)
                .map(MoodType::getEmoji)
                .collect(Collectors.joining(" "));

        boolean matched = !matchedPhotoIds.isEmpty();

        FastApiDiaryRequest faReq = FastApiDiaryRequest.builder()
                .item_name(combinedItemName.isEmpty() ? null : combinedItemName)
                .category(combinedCategory.isEmpty() ? null : combinedCategory)
                .price(actualPrice > 0 ? actualPrice : null)
                .store_name(combinedStoreName.isEmpty() ? null : combinedStoreName)
                .description(combinedDescription.isEmpty() ? null : combinedDescription)
                .matched(matched)
                .mood(moodEmoji)
                .emotion_text(combinedEmotionText.isEmpty() ? null : combinedEmotionText)
                .tags(Collections.singletonList("#" + group.getGroupName()))
                .group_description(group.getGroupDescription())
                .room_category(group.getCategory() != null ? group.getCategory().name() : null)
                .build();

        FastApiDiaryResponse faRes;
        try {
            faRes = callFastApiDiary(faReq);
        } catch (Exception e) {
            return DiaryGenerateResponse.builder()
                    .title("오늘의 소비 기록")
                    .diaryLines(Arrays.asList("잠시 서버가 바빠요", "나중에 다시 시도해보세요", "오늘의 소비는 기억 속에 남겨두기로", "잠깐의 쉼도 좋은 법이야"))
                    .tags(Collections.singletonList("#" + group.getGroupName()))
                    .roomId(req.getGroupId())
                    .roomLabel(group.getGroupName())
                    .imageUrls(imageUrls)
                    .photoIds(photoIds)
                    .matchedPhotoIds(matchedPhotoIds)
                    .build();
        }

        // 일기 생성 완료 후 VLM 카테고리 보정 비동기 요청
        try {
            HttpHeaders fallbackHeaders = new HttpHeaders();
            fallbackHeaders.set("X-Internal-Secret", internalSecret);
            restTemplate.exchange(
                    fastapiVlmFallbackUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(fallbackHeaders),
                    Void.class
            );
        } catch (Exception ignored) {
            // 실패해도 일기 생성 결과에 영향 없음
        }

        return DiaryGenerateResponse.builder()
                .title(faRes.getTitle())
                .diaryLines(faRes.getDiary_lines())
                .tags(faRes.getTags())
                .roomId(req.getGroupId())
                .roomLabel(group.getGroupName())
                .imageUrls(imageUrls)
                .photoIds(photoIds)
                .matchedPhotoIds(matchedPhotoIds)
                .build();
    }

    @Transactional
    public void saveDiary(DiarySaveRequest req, Long userId) {

        Diary diary = Diary.builder()
                .userId(userId)
                .groupId(req.getGroupId())
                .diaryContent(req.getDiaryContent())
                .build();
        diaryRepository.save(diary);

        if (req.getPhotoIds() != null && !req.getPhotoIds().isEmpty()) {
            for (Long photoId : req.getPhotoIds()) {
                DiaryPhoto diaryPhoto = DiaryPhoto.builder()
                        .id(new DiaryPhotoId(photoId, diary.getDiaryId(), userId))
                        .build();
                diaryPhotoRepository.save(diaryPhoto);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<DiaryFeedItemResponse> getDiaryList(Long groupId) {
        List<Diary> diaries = diaryRepository.findByGroupIdOrderByCreatedAtDesc(groupId);
        if (diaries.isEmpty()) return Collections.emptyList();

        Group group = groupRepository.findById(groupId).orElse(null);

        Set<Long> userIds = diaries.stream().map(Diary::getUserId).collect(Collectors.toSet());
        Map<Long, User> userMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getUserId, u -> u));

        List<Long> diaryIds = diaries.stream().map(Diary::getDiaryId).collect(Collectors.toList());
        Map<Long, List<DiaryPhoto>> diaryPhotosMap = diaryPhotoRepository.findByIdDiaryIdIn(diaryIds)
                .stream().collect(Collectors.groupingBy(dp -> dp.getId().getDiaryId()));

        Set<Long> allPhotoIds = diaryPhotosMap.values().stream()
                .flatMap(List::stream)
                .map(dp -> dp.getId().getPhotoId())
                .collect(Collectors.toSet());
        Map<Long, Photo> photoMap = photoRepository.findAllById(allPhotoIds).stream()
                .collect(Collectors.toMap(Photo::getPhotoId, p -> p));

        Set<Long> matchedPhotoIds = allPhotoIds.isEmpty()
                ? Collections.emptySet()
                : personaTransactionRepository.findMatchedPhotoIds(allPhotoIds);

        return diaries.stream().map(diary -> {
            String authorName = Optional.ofNullable(userMap.get(diary.getUserId()))
                    .map(User::getName).orElse("익명");

            List<Long> dpPhotoIds = diaryPhotosMap.getOrDefault(diary.getDiaryId(), Collections.emptyList())
                    .stream().map(dp -> dp.getId().getPhotoId()).collect(Collectors.toList());
            List<String> imageUrls = dpPhotoIds.stream()
                    .map(photoMap::get).filter(Objects::nonNull)
                    .map(Photo::getImageUrl).filter(Objects::nonNull)
                    .collect(Collectors.toList());
            List<Long> dpMatchedPhotoIds = dpPhotoIds.stream()
                    .filter(matchedPhotoIds::contains).collect(Collectors.toList());

            String title = "";
            String subtitle = "";
            List<String> lines = Collections.emptyList();
            if (diary.getDiaryContent() != null) {
                try {
                    JsonNode node = objectMapper.readTree(diary.getDiaryContent());
                    title = node.path("title").asText("");
                    subtitle = node.path("subtitle").asText("");
                    JsonNode linesNode = node.path("lines");
                    if (linesNode.isArray()) {
                        lines = new ArrayList<>();
                        for (JsonNode ln : linesNode) lines.add(ln.asText());
                    }
                } catch (Exception ignored) {}
            }

            return DiaryFeedItemResponse.builder()
                    .diaryId(diary.getDiaryId())
                    .title(title)
                    .subtitle(subtitle)
                    .diaryLines(lines)
                    .date(diary.getCreatedAt() != null ? diary.getCreatedAt().toLocalDate().toString() : "")
                    .time(diary.getCreatedAt() != null
                            ? diary.getCreatedAt()
                            .toLocalTime()
                            .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) : "")
                    .authorName(authorName)
                    .authorId(diary.getUserId())
                    .imageUrls(imageUrls)
                    .imageUrl(imageUrls.isEmpty() ? null : imageUrls.get(0))
                    .roomId(diary.getGroupId())
                    .roomLabel(group != null ? group.getGroupName() : "")
                    .likes(diary.getLikes() != null ? diary.getLikes() : 0)
                    .photoIds(dpPhotoIds)
                    .matchedPhotoIds(dpMatchedPhotoIds)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DiaryPreviewResponse getDiaryPreview(Long groupId, Long userId) {
        long count = diaryRepository.countByGroupId(groupId);

        LocalDateTime startOfWeek = LocalDate.now(ZoneId.of("Asia/Seoul"))
                .with(DayOfWeek.MONDAY).atStartOfDay();
        LocalDateTime endOfWeek = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        long myCount = diaryRepository.countByUserIdAndDateRange(userId, startOfWeek, endOfWeek);

        String imageUrl = diaryRepository.findFirstImageUrlByGroupId(groupId).orElse(null);
        return new DiaryPreviewResponse(count, myCount, imageUrl);
    }

    @Transactional
    public void toggleLike(Long diaryId) {
        Diary diary = diaryRepository.findById(diaryId)
                .orElseThrow(() -> new RuntimeException("일기를 찾을 수 없습니다."));
        int current = diary.getLikes() != null ? diary.getLikes() : 0;
        diary.setLikes(current + 1);
        diaryRepository.save(diary);
    }

    private FastApiDiaryResponse callFastApiDiary(FastApiDiaryRequest req) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<FastApiDiaryRequest> entity = new HttpEntity<>(req, headers);

        ResponseEntity<FastApiDiaryResponse> response = restTemplate.exchange(
                fastapiDiaryUrl,
                HttpMethod.POST,
                entity,
                FastApiDiaryResponse.class
        );

        if (response.getBody() == null) {
            throw new RuntimeException("FastAPI 일기 생성 응답이 비어있습니다.");
        }
        return response.getBody();
    }

    @Getter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    static class FastApiDiaryRequest {
        private String item_name;
        private String category;
        private Integer price;
        private String store_name;
        private String description;
        private Boolean matched;
        private String mood;
        private String emotion_text;
        private List<String> tags;
        private String group_description;
        private String room_category;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    static class FastApiDiaryResponse {
        private String title;
        private List<String> diary_lines;
        private List<String> tags;
    }

    public void syncTransactions(Long userId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Secret", internalSecret);
            Map<String, Object> body = Map.of("user_id", userId, "days", 1);
            restTemplate.exchange(fastapiSyncUrl, HttpMethod.POST,
                    new HttpEntity<>(body, headers), String.class);
        } catch (Exception ignored) {
            // sync 실패해도 계속 진행
        }
    }

    @Transactional(readOnly = true)
    public List<DiaryFeedItemResponse> getMyDiaryList(Long userId) {
        List<Diary> diaries = diaryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (diaries.isEmpty()) return Collections.emptyList();

        Set<Long> userIds = diaries.stream().map(Diary::getUserId).collect(Collectors.toSet());
        Map<Long, User> userMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getUserId, u -> u));

        Set<Long> groupIds = diaries.stream().map(Diary::getGroupId).collect(Collectors.toSet());
        Map<Long, Group> groupMap = groupRepository.findAllById(groupIds).stream()
                .collect(Collectors.toMap(Group::getGroupId, g -> g));

        List<Long> diaryIds = diaries.stream().map(Diary::getDiaryId).collect(Collectors.toList());
        Map<Long, List<DiaryPhoto>> diaryPhotosMap = diaryPhotoRepository.findByIdDiaryIdIn(diaryIds)
                .stream().collect(Collectors.groupingBy(dp -> dp.getId().getDiaryId()));

        Set<Long> allPhotoIds = diaryPhotosMap.values().stream()
                .flatMap(List::stream)
                .map(dp -> dp.getId().getPhotoId())
                .collect(Collectors.toSet());
        Map<Long, Photo> photoMap = photoRepository.findAllById(allPhotoIds).stream()
                .collect(Collectors.toMap(Photo::getPhotoId, p -> p));

        Set<Long> matchedPhotoIds = allPhotoIds.isEmpty()
                ? Collections.emptySet()
                : personaTransactionRepository.findMatchedPhotoIds(allPhotoIds);

        return diaries.stream().map(diary -> {
            String authorName = Optional.ofNullable(userMap.get(diary.getUserId()))
                    .map(User::getName).orElse("익명");

            Group group = groupMap.get(diary.getGroupId());

            List<Long> dpPhotoIds = diaryPhotosMap.getOrDefault(diary.getDiaryId(), Collections.emptyList())
                    .stream().map(dp -> dp.getId().getPhotoId()).collect(Collectors.toList());
            List<String> imageUrls = dpPhotoIds.stream()
                    .map(photoMap::get).filter(Objects::nonNull)
                    .map(Photo::getImageUrl).filter(Objects::nonNull)
                    .collect(Collectors.toList());
            List<Long> dpMatchedPhotoIds = dpPhotoIds.stream()
                    .filter(matchedPhotoIds::contains).collect(Collectors.toList());

            String title = "";
            String subtitle = "";
            List<String> lines = Collections.emptyList();
            if (diary.getDiaryContent() != null) {
                try {
                    JsonNode node = objectMapper.readTree(diary.getDiaryContent());
                    title = node.path("title").asText("");
                    subtitle = node.path("subtitle").asText("");
                    JsonNode linesNode = node.path("lines");
                    if (linesNode.isArray()) {
                        lines = new ArrayList<>();
                        for (JsonNode ln : linesNode) lines.add(ln.asText());
                    }
                } catch (Exception ignored) {}
            }

            return DiaryFeedItemResponse.builder()
                    .diaryId(diary.getDiaryId())
                    .title(title)
                    .subtitle(subtitle)
                    .diaryLines(lines)
                    .date(diary.getCreatedAt() != null ? diary.getCreatedAt().toLocalDate().toString() : "")
                    .time(diary.getCreatedAt() != null
                            ? diary.getCreatedAt()
                            .toLocalTime()
                            .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) : "")
                    .authorName(authorName)
                    .authorId(diary.getUserId())
                    .imageUrls(imageUrls)
                    .imageUrl(imageUrls.isEmpty() ? null : imageUrls.get(0))
                    .roomId(diary.getGroupId())
                    .roomLabel(group != null ? group.getGroupName() : "")
                    .likes(diary.getLikes() != null ? diary.getLikes() : 0)
                    .photoIds(dpPhotoIds)
                    .matchedPhotoIds(dpMatchedPhotoIds)
                    .build();
        }).collect(Collectors.toList());
    }
}