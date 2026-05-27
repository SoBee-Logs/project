package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

// photo_vlm_results 테이블 매핑 — VLM이 분석한 소비 정보를 저장
@Entity
@Table(name = "photo_vlm_results")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class PhotoVlmResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vlm_id")
    private Long vlmId;

    // 연결된 사진 ID (photos 테이블 FK)
    @Column(name = "photo_id", nullable = false)
    private Long photoId;

    // VLM이 분류한 소비 카테고리
    @Column(name = "vlm_category", length = 100)
    private String vlmCategory;

    // VLM이 추출한 품목명
    @Column(name = "vlm_item_name", length = 200)
    private String vlmItemName;

    // VLM이 추정한 가격
    @Column(name = "vlm_price_estimate", precision = 18, scale = 2)
    private BigDecimal vlmPriceEstimate;

    // 가게 유형 (식당, 카페, 마트 등)
    @Column(name = "vlm_store_type", length = 100)
    private String vlmStoreType;

    // 가게 이름
    @Column(name = "vlm_store_name", length = 200)
    private String vlmStoreName;

    // VLM이 생성한 사진 설명
    @Column(name = "vlm_description", columnDefinition = "TEXT")
    private String vlmDescription;

    // 분석 신뢰도 (high / medium / low)
    @Column(name = "vlm_confidence", length = 10, nullable = false)
    private String vlmConfidence;

    // 역지오코딩으로 얻은 주소
    @Column(name = "vlm_address", length = 500)
    private String vlmAddress;
}