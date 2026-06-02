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

    // 특정 유저의 날짜 범위 내 지출 합계 조회 (주간 AlertBoard 계산용)
    // paymentDate가 VARCHAR이므로 문자열 BETWEEN 비교 사용
    @Query("SELECT COALESCE(SUM(t.paymentOut), 0) FROM Transaction t " +
            "WHERE t.id.userId = :userId " +
            "AND t.paymentDate BETWEEN :startDate AND :endDate " +
            "AND t.paymentOut > 0")
    Long sumOutgoingByUserIdAndDateRange(
            @Param("userId") Long userId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );
}