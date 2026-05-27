package com.sobee.sobee.domain.b_log.dto;

import lombok.*;
import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoListResponse {
    private List<PhotoResponse> photos;
}