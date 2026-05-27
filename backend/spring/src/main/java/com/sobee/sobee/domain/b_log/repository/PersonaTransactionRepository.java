package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.PersonaTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonaTransactionRepository extends JpaRepository<PersonaTransaction, Long> {

    // 해당 photoId로 결제 매핑 레코드가 존재하는지 확인
    boolean existsByPhotoId(Long photoId);
}