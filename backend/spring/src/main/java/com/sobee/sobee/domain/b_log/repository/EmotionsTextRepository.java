// domain/b_log/repository/EmotionsTextRepository.java
package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.EmotionsText;
import com.sobee.sobee.domain.b_log.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmotionsTextRepository extends JpaRepository<EmotionsText, Long> {
    Optional<EmotionsText> findByPhoto(Photo photo);
}