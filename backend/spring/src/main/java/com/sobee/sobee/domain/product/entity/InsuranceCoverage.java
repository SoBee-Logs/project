package com.sobee.sobee.domain.product.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "insurance_coverages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InsuranceCoverage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long coverageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false, columnDefinition = "VARCHAR(50)")
    private InsuranceProduct insuranceProduct;

    @Column(name = "item_name", nullable = false, length = 100)
    private String itemName;

    @Column(name = "condition_text", columnDefinition = "TEXT")
    private String conditionText;

    @Column(name = "exclusion_text", columnDefinition = "TEXT")
    private String exclusionText;
}