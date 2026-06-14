// domain/b_log/entity/Photo.java
package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "photos")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "photo_id")
    private Long photoId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "image_url", length = 200)
    private String imageUrl;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // is_valid 제거

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        }
    }
}