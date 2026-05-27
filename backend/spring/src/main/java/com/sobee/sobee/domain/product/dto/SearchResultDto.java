package com.sobee.sobee.domain.product.dto;

import lombok.*;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResultDto {

    private String keyword;
    private int totalCount;

    private List<CardResult> cards;
    private List<SavingsResult> savings;
    private List<InsuranceResult> insurance;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardResult {
        private Long cardInfoId;
        private Integer gorillaId;
        private String cardName;
        private String corpName;
        private String cardType;
        private String annualFeeBasic;
        private Integer minPerformance;
        private String cardImgUrl;
        private Boolean isDiscontinued;
        private List<String> topBenefitTitles;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SavingsResult {
        private Long savingsId;
        private String korCoNm;
        private String finPrdtNm;
        private Integer saveTrm;
        private java.math.BigDecimal intrRate;
        private java.math.BigDecimal intrMaxRate;
        private String spclCnd;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InsuranceResult {
        private String productId;
        private String productName;
        private String insurer;
        private String category;
        private String situationTags;
        private Integer coveragePeriodDays;
        private String productUrl;
    }
}