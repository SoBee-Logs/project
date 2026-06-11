package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Diary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DiaryRepository extends JpaRepository<Diary, Long> {

    // 특정 모임방의 일기 목록 최신순 조회 (피드 화면용)
    List<Diary> findByGroupIdOrderByCreatedAtDesc(Long groupId);

    long countByGroupId(Long groupId);
    long countByGroupIdAndUserId(Long groupId, Long userId);

    // 홈 피드 썸네일용 — 단일 JOIN 쿼리로 N+1 없이 첫 번째 이미지 URL 조회
    @Query(value = "SELECT p.image_url FROM diary d " +
            "JOIN diary_photos dp ON d.diary_id = dp.diary_id " +
            "JOIN photos p ON dp.photo_id = p.photo_id " +
            "WHERE d.group_id = :groupId " +
            "ORDER BY d.created_at DESC LIMIT 1", nativeQuery = true)
    Optional<String> findFirstImageUrlByGroupId(@Param("groupId") Long groupId);

    // 특정 유저의 특정 방에서 날짜 범위 내 일기 건수 조회 (주간 AlertBoard 방별 계산용)
    @Query("SELECT COUNT(d) FROM Diary d " +
            "WHERE d.userId = :userId " +
            "AND d.groupId = :groupId " +
            "AND d.createdAt BETWEEN :startDate AND :endDate")
    Long countByUserIdAndGroupIdAndDateRange(
            @Param("userId") Long userId,
            @Param("groupId") Long groupId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );

    @Query("SELECT COUNT(d) FROM Diary d WHERE d.userId = :userId AND d.createdAt BETWEEN :startDate AND :endDate")
        long countByUserIdAndDateRange(
        @Param("userId") Long userId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
        );

    @Query("SELECT COALESCE(SUM(d.likes), 0) FROM Diary d WHERE d.userId = :userId")
        int sumLikesByUserId(@Param("userId") Long userId);

         List<Diary> findByUserIdOrderByCreatedAtDesc(Long userId);    
}