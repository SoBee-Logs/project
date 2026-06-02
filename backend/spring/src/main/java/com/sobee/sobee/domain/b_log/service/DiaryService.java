package com.sobee.sobee.domain.b_log.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sobee.sobee.domain.b_log.dto.DiaryFeedItemResponse;
import com.sobee.sobee.domain.b_log.dto.DiaryGenerateRequest;
import com.sobee.sobee.domain.b_log.dto.DiaryGenerateResponse;
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

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiaryService {

    private final GroupRepository groupRepository;
    private final PhotoGroupsRepository photoGroupsRepository;
    private final PhotoMetadataRepository photoMetadataRepository;
    private final EmotionsTextRepository emotionsTextRepository;
    private final PhotoVlmResultRepository photoVlmResultRepository;
    private final PersonaTransactionRepository personaTransactionRepository;
    private final DiaryRepository diaryRepository;
    private final DiaryPhotoRepository diaryPhotoRepository;
    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final PhotoService photoService;

    @Value("${fastapi.base-url}/api/diary/generate")
    private String fastapiDiaryUrl;
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

        // 미매핑 사진 일괄 매핑 (결제 동기화 완료 시점 보장)
        for (Photo photo : todayPhotos) {
            if (!personaTransactionRepository.existsByPhotoId(photo.getPhotoId())) {
                try {
                    photoService.performMatchingForPhoto(photo.getPhotoId(), userId);
                } catch (Exception ignored) {
                    // 개별 사진 매핑 실패해도 일기 생성 계속 진행
                }
            }
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

        // VLM 결과 수집 (매핑된 사진 전체)
        List<PhotoVlmResult> allVlms = photosForDiary.stream()
        .map(p -> photoVlmResultRepository
                .findFirstByPhotoIdOrderByVlmIdDesc(p.getPhotoId())
                .orElse(null))
        .filter(Objects::nonNull)
        .collect(Collectors.toList());

        // 대표값은 category 있는 것 우선으로 첫 번째 (기존 로직 유지)
        PhotoVlmResult bestVlm = allVlms.stream()
        .filter(vlm -> vlm.getVlmCategory() != null)
        .findFirst()
        .orElse(allVlms.isEmpty() ? null : allVlms.get(0));

        // 여러 사진의 item_name, description 합치기
        String combinedItemName = allVlms.stream()
        .map(PhotoVlmResult::getVlmItemName)
        .filter(Objects::nonNull)
        .collect(Collectors.joining(", "));

        String combinedDescription = allVlms.stream()
        .map(PhotoVlmResult::getVlmDescription)
        .filter(Objects::nonNull)
        .collect(Collectors.joining(" / "));
                        

        // 감정 데이터 — 전체 수집 후 텍스트 합치기
        List<EmotionsText> allEmotions = todayPhotos.stream()
        .map(p -> emotionsTextRepository.findByPhoto(p).orElse(null))
        .filter(Objects::nonNull)
        .collect(Collectors.toList());

        EmotionsText latestEmotion = allEmotions.isEmpty() ? null : allEmotions.get(0);

        String combinedEmotionText = allEmotions.stream()
        .map(EmotionsText::getText)
        .filter(Objects::nonNull)
        .collect(Collectors.joining(", "));

        String moodEmoji = latestEmotion != null && latestEmotion.getEmoji() != null
                ? latestEmotion.getEmoji().getEmoji()
                : null;

        boolean matched = !matchedPhotoIds.isEmpty();

        // FastApiDiaryRequest 빌드 부분 수정
        FastApiDiaryRequest faReq = FastApiDiaryRequest.builder()
        .item_name(combinedItemName.isEmpty() ? null : combinedItemName)
        .category(bestVlm != null ? bestVlm.getVlmCategory() : null)
        .price(bestVlm != null && bestVlm.getVlmPriceEstimate() != null
                ? bestVlm.getVlmPriceEstimate().intValue() : null)
        .store_name(bestVlm != null ? bestVlm.getVlmStoreName() : null)
        .description(combinedDescription.isEmpty() ? null : combinedDescription)
        .matched(matched)
        .mood(moodEmoji)
        .emotion_text(combinedEmotionText.isEmpty() ? null : combinedEmotionText)
        .tags(Collections.singletonList("#" + group.getGroupName()))
        .group_description(group.getGroupDescription())
        // 모임방 카테고리 — FastAPI에서 카테고리별 일기 테마 적용에 사용
        .room_category(group.getCategory() != null ? group.getCategory().name() : null)
        .build();

        FastApiDiaryResponse faRes;
        try {
            faRes = callFastApiDiary(faReq);
        } catch (Exception e) {
            return DiaryGenerateResponse.builder()
                    .title("오늘의 소비 기록")
                    .subtitle("AI 일기 생성에 실패했어요")
                    .diaryLines(Arrays.asList("잠시 서버가 바빠요", "나중에 다시 시도해보세요", "오늘의 소비는 기억 속에 남겨두기로", "잠깐의 쉼도 좋은 법이야"))
                    .tags(Collections.singletonList("#" + group.getGroupName()))
                    .roomId(req.getGroupId())
                    .roomLabel(group.getGroupName())
                    .imageUrls(imageUrls)
                    .photoIds(photoIds)
                    .matchedPhotoIds(matchedPhotoIds)
                    .build();
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
        Group group = groupRepository.findById(groupId).orElse(null);

        return diaries.stream().map(diary -> {

            User author = userRepository.findById(diary.getUserId()).orElse(null);
            String authorName = author != null ? author.getName() : "익명";

            List<DiaryPhoto> diaryPhotos = diaryPhotoRepository
                    .findByIdDiaryId(diary.getDiaryId());

            // 슬라이드 인덱스 순서 유지 — photoIds[i] ↔ imageUrls[i] 1:1 대응
            List<Long> dpPhotoIds = diaryPhotos.stream()
                    .map(dp -> dp.getId().getPhotoId())
                    .collect(Collectors.toList());
            List<String> imageUrls = dpPhotoIds.stream()
                    .map(pid -> photoRepository.findById(pid)
                            .map(Photo::getImageUrl)
                            .orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            // persona_transaction 존재 여부로 매핑된 사진 ID 분류 (배지 표시용)
            List<Long> dpMatchedPhotoIds = dpPhotoIds.stream()
                    .filter(pid -> personaTransactionRepository.existsByPhotoId(pid))
                    .collect(Collectors.toList());

            String title    = "";
            String subtitle = "";
            List<String> lines = Collections.emptyList();
            if (diary.getDiaryContent() != null) {
                try {
                    JsonNode node = objectMapper.readTree(diary.getDiaryContent());
                    title    = node.path("title").asText("");
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
                    .date(diary.getCreatedAt() != null
                            ? diary.getCreatedAt().toLocalDate().toString() : "")
                    .time(diary.getCreatedAt() != null                          // 여기 추가
                            ? diary.getCreatedAt()
                                .atZone(java.time.ZoneOffset.UTC)
                                .withZoneSameInstant(java.time.ZoneId.of("Asia/Seoul"))
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
        // 모임방 카테고리 (EXERCISE, HOBBY 등) — FastAPI 일기 테마 주입용
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
}