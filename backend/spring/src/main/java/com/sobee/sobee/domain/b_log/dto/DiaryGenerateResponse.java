package com.sobee.sobee.domain.b_log.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

// Spring Boot → 프론트엔드: 일기 생성 결과
// DiaryResult 화면 렌더링에 필요한 모든 정보 포함
@Getter
@Builder
public class DiaryGenerateResponse {
    private String title;               // 일기 제목 (LLM 생성)
    private String subtitle;            // 한 줄 요약 (LLM 생성)
    private List<String> diaryLines;    // 일기 본문 4줄 (LLM 생성)
    private List<String> tags;          // 해시태그 목록 (예: ["#거지방"])
    private Long roomId;                // 모임방 ID (= groupId)
    private String roomLabel;           // 모임방 이름 (화면 표시용)
    private List<String> imageUrls;     // 일기에 쓰인 사진 URL 목록
    private List<Long> photoIds;        // DB 저장 시 diary_photos에 INSERT할 사진 ID 목록
    private List<Long> matchedPhotoIds; // 결제 매핑 성공한 사진 ID 목록 (DiaryResult 💳 배지용)
}