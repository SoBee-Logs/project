package com.sobee.sobee.domain.product.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "card_benefits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardBenefit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long cardBenId;

    @JsonBackReference("card-benefits")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_info_id", nullable = false)
    private CardInfo cardInfo;

    @Column(name = "cate_idx")
    private Integer cateIdx;

    @Column(name = "cate_name", length = 100)
    private String cateName;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "info_text", columnDefinition = "TEXT")
    private String infoText;

    @Column(name = "is_notice", nullable = false)
    @Builder.Default
    private Boolean isNotice = false;
}