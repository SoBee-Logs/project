package com.sobee.sobee.domain.group.dto;

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
}