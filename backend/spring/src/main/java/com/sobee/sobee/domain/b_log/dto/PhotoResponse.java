package com.sobee.sobee.domain.b_log.dto;

import lombok.*;
import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoResponse {
    private Long id;
    private String url;
    private String date;
    private String time;
    private String emoji;
    private String text;
    private List<Long> group;
    // 결제 데이터 매핑 성공 여부 (persona_transaction 존재 시 true)
    private boolean mapped;
}