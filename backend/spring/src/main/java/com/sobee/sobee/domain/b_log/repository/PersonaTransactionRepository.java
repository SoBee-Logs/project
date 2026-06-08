package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.PersonaTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PersonaTransactionRepository extends JpaRepository<PersonaTransaction, Long> {

    boolean existsByPhotoId(Long photoId);

    @Query("SELECT p.paymentId FROM PersonaTransaction p WHERE p.userId = :userId")
    List<String> findPaymentIdsByUserId(@Param("userId") Long userId);

    // ← 추가: photoId로 매핑 결과 전체 조회
    List<PersonaTransaction> findByPhotoId(Long photoId);

    boolean existsByPhotoIdAndGroupId(Long photoId, Integer groupId);
}
