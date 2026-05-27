package com.sobee.sobee.domain.product.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "savings_products",
        uniqueConstraints = @UniqueConstraint(columnNames = {"fin_prdt_cd", "save_trm"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavingsProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long savingsId;

    @Column(name = "fin_prdt_cd", nullable = false, length = 50)
    private String finPrdtCd;

    @Column(name = "kor_co_nm", nullable = false, length = 100)
    private String korCoNm;

    @Column(name = "fin_prdt_nm", nullable = false, length = 200)
    private String finPrdtNm;

    @Column(name = "join_way", length = 200)
    private String joinWay;

    @Column(name = "mtrt_int", columnDefinition = "TEXT")
    private String mtrtInt;

    @Column(name = "spcl_cnd", columnDefinition = "TEXT")
    private String spclCnd;

    @Column(name = "join_member", length = 200)
    private String joinMember;

    @Column(name = "etc_note", columnDefinition = "TEXT")
    private String etcNote;

    @Column(name = "dcls_strt_day")
    private LocalDate dclsStrtDay;

    @Column(name = "save_trm")
    private Integer saveTrm;

    @Column(name = "intr_rate", precision = 5, scale = 2)
    private BigDecimal intrRate;

    @Column(name = "intr_max_rate", precision = 5, scale = 2)
    private BigDecimal intrMaxRate;

    @Column(name = "intr_rate_type", length = 10)
    private String intrRateType;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @PrePersist
    public void prePersist() {
        if (syncedAt == null) {
            syncedAt = LocalDateTime.now();
        }
    }
}