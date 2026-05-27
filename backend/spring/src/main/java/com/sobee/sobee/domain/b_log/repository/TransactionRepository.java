package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Transaction;
import com.sobee.sobee.domain.b_log.entity.TransactionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, TransactionId> {

    // 특정 유저의 특정 날짜 지출 내역 조회 (매핑 후보 탐색용)
    // paymentDate 컬럼이 VARCHAR이므로 String 파라미터 사용
    @Query("SELECT t FROM Transaction t WHERE t.id.userId = :userId " +
            "AND t.paymentDate = :date AND t.paymentOut > 0")
    List<Transaction> findOutgoingByUserIdAndDate(
            @Param("userId") Long userId,
            @Param("date") String date
    );
}