package com.sobee.sobee.domain.group.dto;

import com.sobee.sobee.domain.group.entity.RoomCategory;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class GroupRequestDto {
    private String groupName;
    private String groupDescription;

    // 방 테마 카테고리 (선택 사항)
    private RoomCategory category;

    // 주간 소비 목표 금액 (선택 사항)
    private Integer targetBudget;

    // 주간 일기 작성 목표 횟수 (선택 사항)
    private Integer targetDiaryCount;

    // 절약 목표 결제 카테고리 ID (선택 사항)
    private Integer spendingCategoryId;
}