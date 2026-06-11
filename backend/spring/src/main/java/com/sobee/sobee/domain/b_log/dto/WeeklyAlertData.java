package com.sobee.sobee.domain.b_log.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class WeeklyAlertData {
    private String week;            // "1주", "2주", ...
    private String startDate;       // "2026-06-02"
    private String endDate;         // "2026-06-08"

    private Long weeklySpend;       // 해당 주 실제 소비 합계
    private Integer targetBudget;   // 목표 예산
    private String budgetStatus;    // SAFE / WARNING / DANGER

    private Long weeklyDiaryCount;  // 해당 주 실제 일기 수
    private Integer targetDiaryCount;
    private String diaryStatus;     // SAFE / WARNING / DANGER
}
