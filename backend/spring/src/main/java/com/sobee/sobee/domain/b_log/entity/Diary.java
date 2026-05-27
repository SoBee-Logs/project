package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// diary 테이블 매핑 — LLM이 생성한 일기 저장
@Entity
@Table(name = "diary")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Diary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "diary_id")
    private Long diaryId;

    // 작성자 사용자 ID
    @Column(name = "user_id", nullable = false)
    private Long userId;

    // 소속 모임방 ID
    @Column(name = "group_id", nullable = false)
    private Long groupId;

    // LLM 생성 일기 내용 — JSON 직렬화 저장 (title/subtitle/lines)
    @Column(name = "diary_content", length = 200)
    private String diaryContent;

    // 일기 생성 시각 (자동 설정)
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // 좋아요 수 (초기값 0)
    @Setter
    @Column(name = "likes")
    private Integer likes;
  

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.likes = 0;
    }
}