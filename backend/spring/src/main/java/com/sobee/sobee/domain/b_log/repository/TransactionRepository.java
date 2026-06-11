package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Transaction;
import com.sobee.sobee.domain.b_log.entity.TransactionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, TransactionId> {

    @Query("SELECT t FROM Transaction t WHERE t.id.userId = :userId " +
            "AND t.paymentDate = :date AND t.paymentOut > 0")
    List<Transaction> findOutgoingByUserIdAndDate(
            @Param("userId") Long userId,
            @Param("date") String date
    );

    @Query("SELECT COALESCE(SUM(t.paymentOut), 0) FROM Transaction t " +
            "WHERE t.id.userId = :userId " +
            "AND t.paymentDate BETWEEN :startDate AND :endDate " +
            "AND t.paymentOut > 0")
    Long sumOutgoingByUserIdAndDateRange(
            @Param("userId") Long userId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );

    @Query("SELECT t FROM Transaction t WHERE t.id.paymentId = :paymentId")
    Optional<Transaction> findByPaymentId(@Param("paymentId") Long paymentId);

    @Query(value = """
            SELECT cm.category_name
            FROM transactions t
            JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
            WHERE t.user_id = :userId
            AND t.payment_date BETWEEN :startDate AND :endDate
            AND t.payment_out > 0
            GROUP BY cm.category_name
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """, nativeQuery = true)
    String findTopCategoryNameByUserId(
            @Param("userId") Long userId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate
    );
}