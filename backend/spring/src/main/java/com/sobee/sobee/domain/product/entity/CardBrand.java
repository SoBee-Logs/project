package com.sobee.sobee.domain.product.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_brands")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardBrand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long brandId;

    @JsonBackReference("card-brands")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_info_id", nullable = false)
    private CardInfo cardInfo;

    @Column(name = "brand_name", nullable = false, length = 50)
    private String brandName;

    @Column(name = "brand_code", length = 50)
    private String brandCode;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;
}