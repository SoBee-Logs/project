package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.*;
import lombok.*;

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

    @Column(name = "payment_category_id")
    private Integer paymentCategoryId;
}