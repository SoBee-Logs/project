package com.sobee.sobee.domain.group.repository;

import com.sobee.sobee.domain.group.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupRepository extends JpaRepository<Group, Long> {
    Optional<Group> findByGroupCode(String groupCode);
    // N+1 방지: 그룹 ID 목록으로 한 번에 조회
    List<Group> findAllByGroupIdIn(List<Long> groupIds);
}