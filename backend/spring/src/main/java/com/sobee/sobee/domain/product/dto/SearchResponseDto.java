package com.sobee.sobee.domain.product.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter
@Builder
public class SearchResponseDto {
    private String AI_text;
    private List<ProductDto> products;

    @Getter
    @Builder
    public static class ProductDto {
        private String product_name;
        private String product_company;
        private String product_img_url;
        private String product_type;
        private Boolean is_discontinued;
        private ContentDto content;
    }

    @Getter
    @Builder
    public static class ContentDto {
        // 공통 — 목록 카드 뷰에서도 사용
        private String header;
        private String middle;
        private String small;
        private String url;

        // 카드 상세
        private List<BenefitGroup> benefitGroups;
        private String annualFeeDetail;
        private Boolean onlyOnline;
        private Boolean isImpend;

        // 예적금 상세
        private String intrRate;
        private String intrRateType;
        private String joinWay;
        private String joinMember;
        private String etcNote;
        private String mtrtInt;

        // 보험 상세
        private String description;
        private List<CoverageItem> coverages;
        private String ageRange;
        private String gender;
        private String notes;
    }

    @Getter
    @Builder
    public static class BenefitGroup {
        private String cateName;
        private List<BenefitLine> lines;
    }

    @Getter
    @Builder
    public static class BenefitLine {
        private String title;
        private String comment;
    }

    @Getter
    @Builder
    public static class CoverageItem {
        private String itemName;
        private String conditionText;
        private String exclusionText;
    }
}