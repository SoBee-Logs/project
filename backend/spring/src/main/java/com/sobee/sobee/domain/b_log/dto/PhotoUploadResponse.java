// domain/b_log/dto/PhotoUploadResponse.java
package com.sobee.sobee.domain.b_log.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoUploadResponse {

    private Long photoId;
    private String imageUrl;
    private LocalDateTime takenAt;
    private LocalDateTime createdAt;
}