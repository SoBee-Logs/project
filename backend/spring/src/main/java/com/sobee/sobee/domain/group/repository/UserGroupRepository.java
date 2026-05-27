package com.sobee.sobee.domain.group.repository;

import com.sobee.sobee.domain.group.entity.UserGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserGroupRepository extends JpaRepository<UserGroup, Long> {
    List<UserGroup> findByUserId(Long userId);
    boolean existsByUserIdAndGroupId(Long userId, Long groupId);
}