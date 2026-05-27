package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;

// diary_photos 테이블 매핑 — 일기와 사진을 연결하는 중간 테이블
@Entity
@Table(name = "diary_photos")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class DiaryPhoto {

    @EmbeddedId
    private DiaryPhotoId id;
}