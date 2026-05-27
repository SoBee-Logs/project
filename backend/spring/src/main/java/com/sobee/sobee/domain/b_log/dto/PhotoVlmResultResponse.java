package com.sobee.sobee.domain.b_log.dto;

import lombok.*;

// VLM 저장 + 결제 매핑 처리 완료 후 프론트엔드에 반환하는 응답
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoVlmResultResponse {

    private Long vlmId;              // 저장된 VLM 결과 ID
    private Long photoId;            // 연결된 사진 ID
    private boolean matched;         // 결제 내역 매핑 성공 여부
    private String matchedPaymentId; // 매핑된 결제 ID (매핑 실패 시 null)
}