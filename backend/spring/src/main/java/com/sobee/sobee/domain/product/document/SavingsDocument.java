package com.sobee.sobee.domain.product.document;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.math.BigDecimal;

@Document(indexName = "sobee_savings")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SavingsDocument {

    @Id
    private String id;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String finPrdtNm;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String korCoNm;

    @Field(type = FieldType.Integer)
    private Integer saveTrm;

    @Field(type = FieldType.Double)
    private BigDecimal intrRate;

    @Field(type = FieldType.Double)
    private BigDecimal intrMaxRate;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String spclCnd;
}
