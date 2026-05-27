package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.DiaryPhoto;
import com.sobee.sobee.domain.b_log.entity.DiaryPhotoId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DiaryPhotoRepository extends JpaRepository<DiaryPhoto, DiaryPhotoId> {

    // 특정 일기에 연결된 사진 목록 조회 (@EmbeddedId의 diaryId 필드로 검색)
    List<DiaryPhoto> findByIdDiaryId(Long diaryId);
}