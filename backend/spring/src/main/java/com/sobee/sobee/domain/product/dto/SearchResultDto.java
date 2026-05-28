package com.sobee.sobee.domain.product.dto;

import lombok.*;
import java.math.BigDecimal;
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
    public static class BenefitItem {
        private String cateName;
        private String title;
        private String comment;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CoverageItem {
        private String itemName;
        private String conditionText;
        private String exclusionText;
    }

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
        private String annualFeeDetail;
        private Integer minPerformance;
        private Boolean onlyOnline;
        private Boolean isImpend;
        private String cardImgUrl;
        private Boolean isDiscontinued;
        private List<String> topBenefitTitles;
        private List<BenefitItem> benefits;
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
        private BigDecimal intrRate;
        private BigDecimal intrMaxRate;
        private String intrRateType;
        private String spclCnd;
        private String joinWay;
        private String joinMember;
        private String etcNote;
        private String mtrtInt;
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
        private String description;
        private Integer coveragePeriodDays;
        private Integer ageMin;
        private Integer ageMax;
        private String gender;
        private String notes;
        private String productUrl;
        private List<CoverageItem> coverages;
    }
}