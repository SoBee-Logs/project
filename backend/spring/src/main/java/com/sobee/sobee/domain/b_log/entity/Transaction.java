package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Transaction {

    @EmbeddedId
    private TransactionId id;

    @Column(name = "payment_out")
    private Integer paymentOut;

    @Column(name = "payment_in")
    private Integer paymentIn;

    @Column(name = "payment_place", length = 50)
    private String paymentPlace;

    @Column(name = "payment_date")
    private String paymentDate;  // VARCHAR → String

    @Column(name = "payment_time")
    private String paymentTime;  // VARCHAR → String (있다면)

    @Column(name = "payment_category", length = 100)
    private String paymentCategory;

    @Column(name = "payment_address", length = 500)
    private String paymentAddress;

    @Column(name = "source", length = 10)
    private String source;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "approval_no", length = 50)
    private String approvalNo;

    @Column(name = "card_no", length = 50)
    private String cardNo;

    @Column(name = "organization", length = 10)
    private String organization;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;

}