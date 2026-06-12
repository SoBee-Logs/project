package com.sobee.sobee.domain.group.service;

import com.sobee.sobee.domain.b_log.entity.Diary;
import com.sobee.sobee.domain.b_log.repository.DiaryPhotoRepository;
import com.sobee.sobee.domain.b_log.repository.DiaryRepository;
import com.sobee.sobee.domain.b_log.repository.PhotoGroupsRepository;
import com.sobee.sobee.domain.group.dto.GroupRequestDto;
import com.sobee.sobee.domain.group.dto.GroupResponseDto;
import com.sobee.sobee.domain.group.entity.Group;
import com.sobee.sobee.domain.group.entity.UserGroup;
import com.sobee.sobee.domain.group.repository.GroupRepository;
import com.sobee.sobee.domain.group.repository.UserGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final UserGroupRepository userGroupRepository;
    private final DiaryRepository diaryRepository;
    private final DiaryPhotoRepository diaryPhotoRepository;
    private final PhotoGroupsRepository photoGroupsRepository;

    public GroupResponseDto createGroup(GroupRequestDto dto, Long userId) {
        String code = generateCode();
        Group group = Group.builder()
                .groupName(dto.getGroupName())
                .groupDescription(dto.getGroupDescription())
                .groupCode(code)
                .max(10)
                .category(dto.getCategory())
                .targetBudget(dto.getTargetBudget())
                .targetDiaryCount(dto.getTargetDiaryCount())
                .spendingCategoryId(dto.getSpendingCategoryId())
                .build();
        Group saved = groupRepository.save(group);

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

        if (userGroupRepository.existsByUserIdAndGroupId(userId, group.getGroupId())) {
            throw new RuntimeException("이미 참여한 모임입니다.");
        }

        UserGroup userGroup = UserGroup.builder()
                .userId(userId)
                .groupId(group.getGroupId())
                .build();
        userGroupRepository.save(userGroup);

        return toDto(group);
    }

    public List<GroupResponseDto> getMyGroups(Long userId) {
        List<UserGroup> userGroups = userGroupRepository.findByUserId(userId);
        List<Long> groupIds = userGroups.stream()
                .map(UserGroup::getGroupId)
                .collect(Collectors.toList());
        if (groupIds.isEmpty()) return List.of();
        return groupRepository.findAllByGroupIdIn(groupIds).stream()
                .map(this::toDto)
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
                .spendingCategoryId(group.getSpendingCategoryId())
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

    @Transactional
    public void leaveGroup(Long groupId, Long userId) {
        UserGroup userGroup = userGroupRepository.findByUserIdAndGroupId(userId, groupId)
                .orElseThrow(() -> new RuntimeException("모임에 참여하지 않은 사용자입니다."));
        userGroupRepository.delete(userGroup);

        List<UserGroup> remaining = userGroupRepository.findByGroupId(groupId);
        if (remaining.isEmpty()) {
            // 1. 해당 그룹의 diary 목록 조회
            List<Diary> diaries = diaryRepository.findByGroupIdOrderByCreatedAtDesc(groupId);
            List<Long> diaryIds = diaries.stream()
                    .map(Diary::getDiaryId)
                    .collect(Collectors.toList());

            // 2. diary_photo 삭제 (diary_id 기준)
            if (!diaryIds.isEmpty()) {
                diaryPhotoRepository.deleteByIdDiaryIdIn(diaryIds);
            }

            // 3. diary 삭제
            diaryRepository.deleteByGroupId(groupId);

            // 4. photo_groups 삭제
            photoGroupsRepository.deleteByIdGroupId(groupId);

            // 5. group 삭제
            groupRepository.deleteById(groupId);
        }
    }
}