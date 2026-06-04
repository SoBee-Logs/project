package com.sobee.sobee.domain.b_log.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

// Report 화면 AlertBoard에 표시할 주간 목표 달성 현황 DTO
// 메시지 문자열 대신 수치를 반환해 프론트에서 포맷 처리
@Getter
@Builder
@AllArgsConstructor
public class AlertBoardResponse {

    private Long groupId;
    private String groupName;

    // 소비 목표
    private String budgetStatus;    // SAFE / WARNING / DANGER
    private Long weeklySpend;       // 이번 주 실제 소비 합계 (원)
    private Integer targetBudget;   // 목표 예산 (원)

    // 일기 목표
    private String diaryStatus;         // SAFE / WARNING / DANGER
    private Long weeklyDiaryCount;      // 이번 주 방별 실제 일기 수
    private Integer targetDiaryCount;   // 목표 일기 횟수
}
