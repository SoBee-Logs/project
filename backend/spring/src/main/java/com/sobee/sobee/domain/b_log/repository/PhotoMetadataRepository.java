// domain/b_log/repository/PhotoMetadataRepository.java
package com.sobee.sobee.domain.b_log.repository;

import com.sobee.sobee.domain.b_log.entity.Photo;
import com.sobee.sobee.domain.b_log.entity.PhotoMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PhotoMetadataRepository extends JpaRepository<PhotoMetadata, Long> {
    Optional<PhotoMetadata> findByPhoto(Photo photo);
    // VLM 매핑 시 photoId로 직접 조회용
    Optional<PhotoMetadata> findByPhotoPhotoId(Long photoId);
}