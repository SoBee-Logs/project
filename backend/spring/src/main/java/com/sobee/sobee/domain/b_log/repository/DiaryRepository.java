package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Diary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface DiaryRepository extends JpaRepository<Diary, Long> {

    // 특정 모임방의 일기 목록 최신순 조회 (피드 화면용)
    List<Diary> findByGroupIdOrderByCreatedAtDesc(Long groupId);

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
}