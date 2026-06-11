package com.sobee.sobee.domain.b_log.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class AlertBoardResponse {

    private Long groupId;
    private String groupName;
    private Integer spendingCategoryId; // 절약 카테고리 (null이면 전체 지출)

    // 전체 요약 상태 (가장 나쁜 주차 기준 — 헤더 빨간 점용)
    private String budgetStatus;
    private String diaryStatus;

    // 주차별 상세 데이터
    private List<WeeklyAlertData> weeklyData;
}
