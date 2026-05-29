package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.PersonaTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PersonaTransactionRepository extends JpaRepository<PersonaTransaction, Long> {

    // 해당 photoId로 결제 매핑 레코드가 존재하는지 확인
    boolean existsByPhotoId(Long photoId);

    // 해당 유저의 이미 매핑된 paymentId 목록 조회 (중복 매핑 방지용)
    @Query("SELECT p.paymentId FROM PersonaTransaction p WHERE p.userId = :userId")
    List<String> findPaymentIdsByUserId(@Param("userId") Long userId);
}