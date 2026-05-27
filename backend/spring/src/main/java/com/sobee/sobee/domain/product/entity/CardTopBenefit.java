package com.sobee.sobee.domain.product.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_top_benefits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardTopBenefit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long cardBigBenId;

    @JsonBackReference("card-top-benefits")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_info_id", nullable = false)
    private CardInfo cardInfo;

    @Column(name = "title", length = 100)
    private String title;

    @Column(name = "tags", columnDefinition = "JSON")
    private String tags;
}