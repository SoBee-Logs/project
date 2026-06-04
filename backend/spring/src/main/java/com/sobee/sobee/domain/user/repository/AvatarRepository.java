package com.sobee.sobee.domain.user.repository;

import com.sobee.sobee.domain.user.entity.Avatar;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AvatarRepository extends JpaRepository<Avatar, Long> {
    Optional<Avatar> findTopByUserIdOrderByAvatarCreatedAtDesc(Long userId);
}
