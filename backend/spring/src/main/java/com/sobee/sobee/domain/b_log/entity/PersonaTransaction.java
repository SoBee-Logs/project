package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;

// persona_transaction 테이블 매핑 — VLM 분석 결과와 실제 결제 내역을 매핑
@Entity
@Table(name = "persona_transaction")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class PersonaTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vlm_transaction_id")
    private Long vlmTransactionId;

    // VLM 분석 결과 ID (photo_vlm_results.vlm_id)
    @Column(name = "vlm_id", nullable = false)
    private Long vlmId;

    // 사진 ID (photos.photo_id)
    @Column(name = "photo_id", nullable = false)
    private Long photoId;

    // 매핑된 결제 내역 ID (transactions.payment_id)
    @Column(name = "payment_id", nullable = false, length = 255)
    private Long paymentId;

    // 사용자 ID
    @Column(name = "user_id", nullable = false)
    private Long userId;
}