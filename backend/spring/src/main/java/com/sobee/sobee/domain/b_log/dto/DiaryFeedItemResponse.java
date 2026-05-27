package com.sobee.sobee.domain.b_log.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

// 피드 화면에 표시할 일기 항목 응답 DTO
// FeedPost 컴포넌트가 필요로 하는 모든 필드 포함
@Getter
@Builder
public class DiaryFeedItemResponse {

    private Long diaryId;            // diary.diary_id (프론트 key로 사용)
    private String title;            // 일기 제목
    private String subtitle;         // 한 줄 요약
    private List<String> diaryLines; // 일기 본문 줄들
    private String date;             // 생성 날짜 (yyyy-MM-dd)
    private String authorName;       // 작성자 이름 (users.name)
    private Long authorId;           // 작성자 userId
    private List<String> imageUrls;  // 연결된 사진 URL 전체 목록
    private String imageUrl;         // 대표 사진 URL (imageUrls[0])
    private Long roomId;             // 모임방 ID
    private String roomLabel;        // 모임방 이름
    private Integer likes;           // 좋아요 수 (diary.likes)
    private List<Long> photoIds;          // 슬라이드 인덱스와 1:1 대응하는 사진 ID 목록 (배지 표시용)
    private List<Long> matchedPhotoIds;   // 결제 매핑된 사진 ID 목록 (💳/🔍 배지 구분용)
}