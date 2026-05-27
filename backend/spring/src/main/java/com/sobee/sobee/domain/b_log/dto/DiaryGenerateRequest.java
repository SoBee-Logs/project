package com.sobee.sobee.domain.b_log.dto;

import lombok.*;

// 프론트엔드 → Spring Boot: 일기 생성 요청
// groupId와 날짜를 기준으로 해당 방의 오늘 사진을 수집해 일기 생성
// @Setter 필수 — Jackson이 @NoArgsConstructor 사용 시 private 필드에 값을 주입하려면 setter가 있어야 함
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiaryGenerateRequest {
    private Long groupId;   // 대상 모임방 ID
    private String date;    // 조회 날짜 (형식: yyyy-MM-dd)
    private String mood;    // 사용자 소비 기분 이모지 (예: "☺️")
}