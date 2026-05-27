package com.sobee.sobee.domain.product.document;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.util.List;

@Document(indexName = "sobee_cards")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardDocument {

    @Id
    private String id;

    @Field(type = FieldType.Integer)
    private Integer gorillaId;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String cardName;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String corpName;

    @Field(type = FieldType.Keyword)
    private String cardType;

    @Field(type = FieldType.Keyword)
    private String annualFeeBasic;

    @Field(type = FieldType.Integer)
    private Integer minPerformance;

    @Field(type = FieldType.Keyword)
    private String cardImgUrl;

    @Field(type = FieldType.Boolean)
    private Boolean isDiscontinued;

    // card_benefits.cate_name 목록 — 카테고리 검색에 사용
    @Field(type = FieldType.Text, analyzer = "nori")
    private List<String> cateNames;

    // card_top_benefits.title 목록
    @Field(type = FieldType.Text, analyzer = "nori")
    private List<String> topBenefitTitles;
}
