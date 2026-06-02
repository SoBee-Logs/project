package com.sobee.sobee.domain.b_log.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

// Report 화면 AlertBoard에 표시할 주간 목표 달성 현황 DTO
@Getter
@Builder
@AllArgsConstructor
public class AlertBoardResponse {

    // 그룹 ID (어느 방의 알림인지 식별)
    private Long groupId;

    // 그룹명
    private String groupName;

    // 소비 목표 달성 상태 (SAFE / WARNING / DANGER)
    private String budgetStatus;

    // 소비 목표 메시지
    private String budgetMessage;

    // 일기 목표 달성 상태 (SAFE / WARNING / DANGER)
    private String diaryStatus;

    // 일기 목표 메시지
    private String diaryMessage;
}
