package com.sobee.sobee.domain.b_log.dto;

import lombok.*;

// 프론트엔드가 FastAPI VLM 분석 결과를 Spring Boot에 저장 요청할 때 보내는 데이터
// FastAPI /api/vlm/analyze 응답 필드명과 일치시킴
// @Setter 필수 — Jackson이 @NoArgsConstructor 사용 시 private 필드에 값을 주입하려면 setter가 있어야 함
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoVlmResultRequest {

    private String category;       // 소비 카테고리
    private String item_name;      // 품목명 (FastAPI snake_case 그대로 수신)
    private Double price;          // 추정 가격
    private String location_type;  // 가게 유형
    private String store_name;     // 가게 이름
    private String description;    // 사진 설명
    private String confidence;     // 신뢰도 (high/medium/low)
    private String address;        // 역지오코딩 주소
    private String taken_at;       // VLM이 EXIF에서 추출한 실제 촬영 일시 (매핑 날짜 기준으로 사용)
}