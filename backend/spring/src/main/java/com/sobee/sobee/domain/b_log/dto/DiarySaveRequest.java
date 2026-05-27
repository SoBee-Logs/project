package com.sobee.sobee.domain.b_log.dto;

import lombok.*;

import java.util.List;

// 프론트엔드 → Spring Boot: 사용자가 "선택하기" 확인 후 일기 저장 요청
// @Setter 필수 — Jackson이 @NoArgsConstructor 사용 시 private 필드에 값을 주입하려면 setter가 있어야 함
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiarySaveRequest {
    private Long groupId;           // 저장할 일기의 모임방 ID
    private String diaryContent;    // JSON 직렬화된 일기 내용 ({"title":"...","subtitle":"...","lines":[...]})
    private List<Long> photoIds;    // diary_photos 테이블에 연결할 사진 ID 목록
}