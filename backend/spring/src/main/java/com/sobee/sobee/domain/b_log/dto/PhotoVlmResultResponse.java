package com.sobee.sobee.domain.b_log.dto;

import lombok.*;

// VLM 저장 완료 후 프론트엔드에 반환하는 응답 (매핑은 일기 생성 시점으로 지연)
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoVlmResultResponse {

    private Long vlmId;    // 저장된 VLM 결과 ID
    private Long photoId;  // 연결된 사진 ID
}