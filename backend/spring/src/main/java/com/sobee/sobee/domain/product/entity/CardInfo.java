package com.sobee.sobee.domain.product.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "card_info")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long cardInfoId;

    @Column(name = "gorilla_id", nullable = false, unique = true)
    private Integer gorillaId;

    @Column(name = "card_name", nullable = false, length = 200)
    private String cardName;

    @Column(name = "corp_id", nullable = false)
    private Integer corpId;

    @Column(name = "corp_name", nullable = false, length = 100)
    private String corpName;

    @Column(name = "card_type", nullable = false, length = 20)
    private String cardType;

    @Column(name = "c_type", length = 10)
    private String cType;

    @Column(name = "annual_fee_basic", length = 200)
    private String annualFeeBasic;

    @Column(name = "annual_fee_detail", columnDefinition = "TEXT")
    private String annualFeeDetail;

    @Column(name = "min_performance")
    @Builder.Default
    private Integer minPerformance = 0;

    @Column(name = "only_online", nullable = false)
    @Builder.Default
    private Boolean onlyOnline = false;

    @Column(name = "card_img_url", length = 500)
    private String cardImgUrl;

    @Column(name = "is_discontinued", nullable = false)
    @Builder.Default
    private Boolean isDiscontinued = false;

    @Column(name = "is_impend", nullable = false)
    @Builder.Default
    private Boolean isImpend = false;

    @Column(name = "release_dt")
    private LocalDate releaseDt;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @JsonManagedReference("card-brands")
    @OneToMany(mappedBy = "cardInfo", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CardBrand> brands = new ArrayList<>();

    @JsonManagedReference("card-benefits")
    @OneToMany(mappedBy = "cardInfo", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CardBenefit> benefits = new ArrayList<>();

    @JsonManagedReference("card-top-benefits")
    @OneToMany(mappedBy = "cardInfo", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CardTopBenefit> topBenefits = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (syncedAt == null) syncedAt = LocalDateTime.now();
    }

    public void addBrand(CardBrand brand) {
        brands.add(brand);
        brand.setCardInfo(this);
    }

    public void addBenefit(CardBenefit benefit) {
        benefits.add(benefit);
        benefit.setCardInfo(this);
    }

    public void addTopBenefit(CardTopBenefit topBenefit) {
        topBenefits.add(topBenefit);
        topBenefit.setCardInfo(this);
    }
}