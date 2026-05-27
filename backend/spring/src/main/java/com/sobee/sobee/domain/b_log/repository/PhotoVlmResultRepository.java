package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.PhotoVlmResult;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoVlmResultRepository extends JpaRepository<PhotoVlmResult, Long> {

    // 특정 사진의 VLM 분석 결과 조회 — 여러 번 분석됐을 경우 가장 최근 것 사용
    java.util.Optional<PhotoVlmResult> findFirstByPhotoIdOrderByVlmIdDesc(Long photoId);
}