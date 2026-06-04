package com.sobee.sobee.domain.group.service;

import com.sobee.sobee.domain.group.dto.GroupRequestDto;
import com.sobee.sobee.domain.group.dto.GroupResponseDto;
import com.sobee.sobee.domain.group.entity.Group;
import com.sobee.sobee.domain.group.entity.UserGroup;
import com.sobee.sobee.domain.group.repository.GroupRepository;
import com.sobee.sobee.domain.group.repository.UserGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final UserGroupRepository userGroupRepository;

    public GroupResponseDto createGroup(GroupRequestDto dto, Long userId) {
        String code = generateCode();
        Group group = Group.builder()
                .groupName(dto.getGroupName())
                .groupDescription(dto.getGroupDescription())
                .groupCode(code)
                .max(10)
                // 카테고리 및 목표값 저장 (선택 사항이므로 null 허용)
                .category(dto.getCategory())
                .targetBudget(dto.getTargetBudget())
                .targetDiaryCount(dto.getTargetDiaryCount())
                .build();
        Group saved = groupRepository.save(group);

        // user_group에 저장
        UserGroup userGroup = UserGroup.builder()
                .userId(userId)
                .groupId(saved.getGroupId())
                .build();
        userGroupRepository.save(userGroup);

        return toDto(saved);
    }

    public GroupResponseDto joinGroup(String code, Long userId) {
        Group group = groupRepository.findByGroupCode(code)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 코드입니다."));

        // 이미 참여한 모임인지 확인
        if (userGroupRepository.existsByUserIdAndGroupId(userId, group.getGroupId())) {
            throw new RuntimeException("이미 참여한 모임입니다.");
        }

        // user_group에 저장
        UserGroup userGroup = UserGroup.builder()
                .userId(userId)
                .groupId(group.getGroupId())
                .build();
        userGroupRepository.save(userGroup);

        return toDto(group);
    }

    public List<GroupResponseDto> getMyGroups(Long userId) {
        List<UserGroup> userGroups = userGroupRepository.findByUserId(userId);
        return userGroups.stream()
                .map(ug -> groupRepository.findById(ug.getGroupId())
                        .map(this::toDto)
                        .orElse(null))
                .filter(g -> g != null)
                .collect(Collectors.toList());
    }

    private GroupResponseDto toDto(Group group) {
        return GroupResponseDto.builder()
                .groupId(group.getGroupId())
                .groupName(group.getGroupName())
                .groupDescription(group.getGroupDescription())
                .groupCode(group.getGroupCode())
                .category(group.getCategory())
                .targetBudget(group.getTargetBudget())
                .targetDiaryCount(group.getTargetDiaryCount())
                .build();
    }

    private String generateCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public void leaveGroup(Long groupId, Long userId) {
        UserGroup userGroup = userGroupRepository.findByUserIdAndGroupId(userId, groupId)
                .orElseThrow(() -> new RuntimeException("모임에 참여하지 않은 사용자입니다."));
        userGroupRepository.delete(userGroup);
    
        // 남은 멤버가 없으면 그룹 삭제
        List<UserGroup> remaining = userGroupRepository.findByGroupId(groupId);
        if (remaining.isEmpty()) {
            groupRepository.deleteById(groupId);
        }
    }
}