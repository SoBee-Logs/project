package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import java.io.Serializable;

// transactions 테이블의 복합 PK (payment_id + user_id) — PhotoGroupsId와 동일한 패턴
@Embeddable
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class TransactionId implements Serializable {

    @Column(name = "payment_id")
    private Long paymentId;

    @Column(name = "user_id")
    private Long userId;
}