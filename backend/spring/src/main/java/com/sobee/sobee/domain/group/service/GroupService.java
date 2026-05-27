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
}