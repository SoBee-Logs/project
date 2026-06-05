package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "persona_transaction")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class PersonaTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vlm_transaction_id")  // ← 여기
    private Long id;
    @Column(name = "vlm_id")
    private Long vlmId;

    @Column(name = "photo_id")
    private Long photoId;

    @Column(name = "group_id")
    private Integer groupId;

    @Column(name = "group_store", length = 200)
    private String groupStore;

    @Column(name = "group_category", length = 100)
    private String groupCategory;

    @Column(name = "group_price", precision = 18, scale = 2)
    private BigDecimal groupPrice;

    @Column(name = "payment_id")
    private Long paymentId;

    @Column(name = "user_id")
    private Long userId;
}