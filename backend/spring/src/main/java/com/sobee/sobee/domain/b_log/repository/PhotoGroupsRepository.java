// domain/b_log/repository/PhotoGroupsRepository.java
package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Photo;
import com.sobee.sobee.domain.b_log.entity.PhotoGroups;
import com.sobee.sobee.domain.b_log.entity.PhotoGroupsId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhotoGroupsRepository extends JpaRepository<PhotoGroups, PhotoGroupsId> {
    List<PhotoGroups> findByPhoto(Photo photo);

    // 특정 모임방(groupId)에 속한 모든 photo_groups 레코드 조회 — 일기 생성 시 대상 사진 수집에 사용
    List<PhotoGroups> findByIdGroupId(Long groupId);
}