// domain/b_log/repository/PhotoRepository.java
package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface PhotoRepository extends JpaRepository<Photo, Long> {

    // 소비로그 목록은 촬영시각(photo_metadata.taken_at) 기준으로 거른다.
    // 카드에 표시되는 날짜·시간도 taken_at이라, 목록 필터와 표시값이 일치한다.
    @Query("SELECT pm.photo FROM PhotoMetadata pm " +
            "WHERE pm.photo.userId = :userId " +
            "AND pm.takenAt >= :startOfDay AND pm.takenAt < :endOfDay")
    List<Photo> findByUserIdAndDate(
            @Param("userId") Long userId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    List<Photo> findByUserId(@Param("userId") Long userId);
}