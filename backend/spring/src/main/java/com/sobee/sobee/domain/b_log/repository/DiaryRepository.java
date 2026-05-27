package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Diary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DiaryRepository extends JpaRepository<Diary, Long> {

    // 특정 모임방의 일기 목록 최신순 조회 (피드 화면용)
    List<Diary> findByGroupIdOrderByCreatedAtDesc(Long groupId);
}