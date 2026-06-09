package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.DiaryPhoto;
import com.sobee.sobee.domain.b_log.entity.DiaryPhotoId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DiaryPhotoRepository extends JpaRepository<DiaryPhoto, DiaryPhotoId> {

    List<DiaryPhoto> findByIdDiaryId(Long diaryId);

    List<DiaryPhoto> findByIdDiaryIdIn(Collection<Long> diaryIds);
}