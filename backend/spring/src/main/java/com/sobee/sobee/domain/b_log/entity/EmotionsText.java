// domain/b_log/entity/EmotionsText.java
package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "emotions_text")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class EmotionsText {

    @Id
    @Column(name = "photo_id")
    private Long photoId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "photo_id")
    private Photo photo;

    @Column(name = "text", length = 100)
    private String text;

    @Enumerated(EnumType.STRING)   // ← enum을 문자열로 저장
    @Column(name = "emoji", length = 20)
    private MoodType emoji;
}