package com.sobee.sobee.domain.group.dto;

import com.sobee.sobee.domain.group.entity.RoomCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class GroupResponseDto {
    private Long groupId;
    private String groupName;
    private String groupDescription;
    private String groupCode;

    // 방 테마 카테고리
    private RoomCategory category;

    // 주간 소비 목표 금액
    private Integer targetBudget;

    // 주간 일기 작성 목표 횟수
    private Integer targetDiaryCount;
}