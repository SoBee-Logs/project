// domain/b_log/dto/PhotoUploadRequest.java
package com.sobee.sobee.domain.b_log.dto;

import lombok.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoUploadRequest {

    private MultipartFile image;
    private String takenAt;
    private Double latitude;
    private Double longitude;
    private String text;
    private String emoji;
    private List<Long> groupId;
}