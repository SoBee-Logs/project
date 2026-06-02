package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.dto.AlertBoardResponse;
import com.sobee.sobee.domain.b_log.repository.DiaryRepository;
import com.sobee.sobee.domain.b_log.repository.TransactionRepository;
import com.sobee.sobee.domain.group.entity.Group;
import com.sobee.sobee.domain.group.entity.UserGroup;
import com.sobee.sobee.domain.group.repository.GroupRepository;
import com.sobee.sobee.domain.group.repository.UserGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportAlertService {

    private final UserGroupRepository userGroupRepository;
    private final GroupRepository groupRepository;
    private final TransactionRepository transactionRepository;
    private final DiaryRepository diaryRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // 유저가 속한 모든 방의 이번 주 AlertBoard 목록 반환
    // 목표가 설정되지 않은 방은 결과에서 제외
    @Transactional(readOnly = true)
    public List<AlertBoardResponse> getAlertBoards(Long userId) {
        // 이번 주 월요일~일요일 범위 계산
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate weekEnd   = today.with(DayOfWeek.SUNDAY);

        String startDateStr = weekStart.format(DATE_FMT);
        String endDateStr   = weekEnd.format(DATE_FMT);

        LocalDateTime startDateTime = weekStart.atStartOfDay();
        LocalDateTime endDateTime   = weekEnd.plusDays(1).atStartOfDay();

        // 이번 주 소비 합계 — 유저 전체 기준 (transactions는 방 구분 없음)
        long weeklySpend = transactionRepository
                .sumOutgoingByUserIdAndDateRange(userId, startDateStr, endDateStr);

        // 유저가 속한 모든 그룹 조회
        List<UserGroup> userGroups = userGroupRepository.findByUserId(userId);

        final LocalDateTime startDt = startDateTime;
        final LocalDateTime endDt = endDateTime;

        return userGroups.stream()
                .map(ug -> groupRepository.findById(ug.getGroupId()).orElse(null))
                .filter(Objects::nonNull)
                // 목표값이 하나라도 설정된 방만 AlertBoard 생성
                .filter(g -> g.getTargetBudget() != null || g.getTargetDiaryCount() != null)
                .map(g -> {
                    // 일기 카운트는 방(group_id)별로 따로 계산
                    long groupDiaryCount = diaryRepository
                            .countByUserIdAndGroupIdAndDateRange(userId, g.getGroupId(), startDt, endDt);
                    return buildAlert(g, weeklySpend, groupDiaryCount);
                })
                .collect(Collectors.toList());
    }

    // 그룹별 AlertBoard 객체 생성
    private AlertBoardResponse buildAlert(Group group, long weeklySpend, long weeklyDiaryCount) {
        String budgetStatus  = "SAFE";
        String budgetMessage = null;
        String diaryStatus   = "SAFE";
        String diaryMessage  = null;

        // 소비 목표 상태 판정
        if (group.getTargetBudget() != null && group.getTargetBudget() > 0) {
            int target = group.getTargetBudget();
            double ratio = (double) weeklySpend / target;

            if (ratio >= 1.0) {
                // 예산 초과
                budgetStatus  = "DANGER";
                budgetMessage = String.format(
                        "이번 주 예산 %s원을 초과했어요! 현재 %s원 소비 💸",
                        String.format("%,d", target),
                        String.format("%,d", weeklySpend)
                );
            } else if (ratio >= 0.8) {
                // 80% 이상 사용
                budgetStatus  = "WARNING";
                budgetMessage = String.format(
                        "이번 주 예산 %s원 중 %s원을 썼어요! 💸",
                        String.format("%,d", target),
                        String.format("%,d", weeklySpend)
                );
            }
        }

        // 일기 목표 상태 판정
        if (group.getTargetDiaryCount() != null && group.getTargetDiaryCount() > 0) {
            int target = group.getTargetDiaryCount();
            long remaining = target - weeklyDiaryCount;

            if (weeklyDiaryCount == 0) {
                // 한 건도 작성 안 함
                diaryStatus  = "DANGER";
                diaryMessage = String.format(
                        "이번 주 일기를 아직 한 번도 안 썼어요! 목표는 %d회예요 ✍️", target
                );
            } else if (weeklyDiaryCount < target) {
                double ratio = (double) weeklyDiaryCount / target;
                if (ratio < 0.8) {
                    // 80% 미달
                    diaryStatus  = "WARNING";
                    diaryMessage = String.format(
                            "주간 목표 %d회까지 %d회 남았어요 ✍️", target, remaining
                    );
                }
            }
        }

        return AlertBoardResponse.builder()
                .groupId(group.getGroupId())
                .groupName(group.getGroupName())
                .budgetStatus(budgetStatus)
                .budgetMessage(budgetMessage)
                .diaryStatus(diaryStatus)
                .diaryMessage(diaryMessage)
                .build();
    }
}
