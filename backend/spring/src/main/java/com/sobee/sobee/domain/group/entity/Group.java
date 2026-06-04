package com.sobee.sobee.domain.group.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "groupss")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "group_name", length = 50)
    private String groupName;

    @Column(name = "group_description", length = 200)
    private String groupDescription;

    @Column(name = "group_code", length = 15)
    private String groupCode;

    @Column(name = "max")
    private Integer max;

    // 모임방 테마 카테고리 (EXERCISE, HOBBY, TRAVEL, FAMILY, DAILY, FOOD, PET)
    @Enumerated(EnumType.STRING)
    @Column(name = "group_category", length = 20)
    private RoomCategory category;

    // 주간 소비 목표 금액 (원 단위, 미설정 시 null)
    @Column(name = "group_target_budget")
    private Integer targetBudget;

    // 주간 일기 작성 목표 횟수 (미설정 시 null)
    @Column(name = "group_target_diary_count")
    private Integer targetDiaryCount;
}