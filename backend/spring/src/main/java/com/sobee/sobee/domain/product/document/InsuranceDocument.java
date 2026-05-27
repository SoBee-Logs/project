package com.sobee.sobee.domain.product.document;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

@Document(indexName = "sobee_insurance")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsuranceDocument {

    @Id
    private String id;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String productName;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String insurer;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String category;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String situationTags;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String description;

    @Field(type = FieldType.Integer)
    private Integer coveragePeriodDays;

    @Field(type = FieldType.Keyword)
    private String productUrl;
}
