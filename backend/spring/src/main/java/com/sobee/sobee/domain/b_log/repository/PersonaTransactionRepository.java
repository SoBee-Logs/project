package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.PersonaTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface PersonaTransactionRepository extends JpaRepository<PersonaTransaction, Long> {

    boolean existsByPhotoId(Long photoId);

    @Query("SELECT p.paymentId FROM PersonaTransaction p WHERE p.userId = :userId")
    List<String> findPaymentIdsByUserId(@Param("userId") Long userId);

    List<PersonaTransaction> findByPhotoId(Long photoId);

    boolean existsByPhotoIdAndGroupId(Long photoId, Integer groupId);

    @Query("SELECT pt.photoId FROM PersonaTransaction pt WHERE pt.photoId IN :photoIds")
    Set<Long> findMatchedPhotoIds(@Param("photoIds") Collection<Long> photoIds);
}
