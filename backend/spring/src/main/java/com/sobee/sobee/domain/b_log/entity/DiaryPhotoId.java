package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

// diary_photos 테이블의 복합 PK (photo_id + diary_id + user_id)
@Embeddable
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class DiaryPhotoId implements Serializable {

    @Column(name = "photo_id")
    private Long photoId;

    @Column(name = "diary_id")
    private Long diaryId;

    @Column(name = "user_id")
    private Long userId;
}