package com.sobee.sobee.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "avatar")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Avatar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "avatar_id")
    private Long avatarId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "avatar_name")
    private String avatarName;

    @Column(name = "avatar_img_url")
    private String avatarImgUrl;

    @Column(name = "avatar_change_reason", columnDefinition = "TEXT")
    private String avatarChangeReason;

    @Column(name = "avatar_explain", columnDefinition = "TEXT")
    private String avatarExplain;

    @Column(name = "avatar_created_at")
    private LocalDateTime avatarCreatedAt;
}
