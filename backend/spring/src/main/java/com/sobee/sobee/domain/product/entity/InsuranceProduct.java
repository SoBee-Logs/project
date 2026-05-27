package com.sobee.sobee.domain.product.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "insurance_products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InsuranceProduct {

    @Id
    @Column(name = "product_id", length = 50)
    private String productId;

    @Column(name = "product_name", nullable = false, length = 100)
    private String productName;

    @Column(name = "insurer", nullable = false, length = 50)
    private String insurer;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "situation_tags", columnDefinition = "TEXT")
    private String situationTags;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "coverage_period_days")
    private Integer coveragePeriodDays;

    @Column(name = "age_min")
    private Integer ageMin;

    @Column(name = "age_max")
    private Integer ageMax;

    @Column(name = "gender", length = 10)
    private String gender;

    @Column(name = "is_mini_insurance", nullable = false)
    @Builder.Default
    private Boolean isMiniInsurance = true;

    @Column(name = "product_url", length = 500)
    private String productUrl;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @OneToMany(mappedBy = "insuranceProduct", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<InsuranceCoverage> coverages = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (syncedAt == null) {
            syncedAt = LocalDateTime.now();
        }
    }

    public void addCoverage(InsuranceCoverage coverage) {
        coverages.add(coverage);
        coverage.setInsuranceProduct(this);
    }
}