package com.sobee.sobee.domain.b_log.service;

import com.sobee.sobee.domain.b_log.dto.AlertBoardResponse;
import com.sobee.sobee.domain.b_log.dto.WeeklyAlertData;
import com.sobee.sobee.domain.b_log.repository.DiaryRepository;
import com.sobee.sobee.domain.b_log.repository.TransactionRepository;
import com.sobee.sobee.domain.group.entity.Group;
import com.sobee.sobee.domain.group.entity.UserGroup;
import com.sobee.sobee.domain.group.repository.GroupRepository;
import com.sobee.sobee.domain.group.repository.UserGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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

    @Transactional(readOnly = true)
    public List<AlertBoardResponse> getAlertBoards(Long userId, Integer yearParam, Integer monthParam) {
        LocalDate today = LocalDate.now();
        int year  = (yearParam  != null) ? yearParam  : today.getYear();
        int month = (monthParam != null) ? monthParam : today.getMonthValue();

        // 해당 월의 마지막 날 기준 (과거 월이면 말일, 현재 월이면 오늘)
        LocalDate endOfMonth = LocalDate.of(year, month, YearMonth.of(year, month).lengthOfMonth());
        LocalDate cutoff = today.isBefore(endOfMonth) ? today : endOfMonth;

        // 리포트 화면과 동일한 주차 목록 생성
        List<WeekRange> weeks = getWeeksOfMonth(year, month, cutoff);

        List<UserGroup> userGroups = userGroupRepository.findByUserId(userId);

        return userGroups.stream()
                .map(ug -> groupRepository.findById(ug.getGroupId()).orElse(null))
                .filter(Objects::nonNull)
                .filter(g -> g.getTargetBudget() != null || g.getTargetDiaryCount() != null)
                .map(g -> buildAlert(g, userId, weeks))
                .collect(Collectors.toList());
    }

    private AlertBoardResponse buildAlert(Group group, Long userId, List<WeekRange> weeks) {
        List<WeeklyAlertData> weeklyData = new ArrayList<>();
        String worstBudgetStatus = "SAFE";
        String worstDiaryStatus  = "SAFE";

        for (WeekRange week : weeks) {
            // 소비 합계: spendingCategoryId 있으면 해당 카테고리만, 없으면 전체
            long spend = (group.getSpendingCategoryId() != null)
                    ? transactionRepository.sumOutgoingByUserIdAndDateRangeAndCategory(
                            userId, week.startStr, week.endStr, group.getSpendingCategoryId())
                    : transactionRepository.sumOutgoingByUserIdAndDateRange(
                            userId, week.startStr, week.endStr);

            // 일기 카운트
            long diaryCount = diaryRepository.countByUserIdAndGroupIdAndDateRange(
                    userId, group.getGroupId(), week.startDt, week.endDt);

            String budgetStatus = calcBudgetStatus(spend, group.getTargetBudget());
            String diaryStatus  = calcDiaryStatus(diaryCount, group.getTargetDiaryCount());

            weeklyData.add(WeeklyAlertData.builder()
                    .week(week.label)
                    .startDate(week.startStr)
                    .endDate(week.endStr)
                    .weeklySpend(spend)
                    .targetBudget(group.getTargetBudget())
                    .budgetStatus(budgetStatus)
                    .weeklyDiaryCount(diaryCount)
                    .targetDiaryCount(group.getTargetDiaryCount())
                    .diaryStatus(diaryStatus)
                    .build());

            if (isWorse(budgetStatus, worstBudgetStatus)) worstBudgetStatus = budgetStatus;
            if (isWorse(diaryStatus,  worstDiaryStatus))  worstDiaryStatus  = diaryStatus;
        }

        return AlertBoardResponse.builder()
                .groupId(group.getGroupId())
                .groupName(group.getGroupName())
                .spendingCategoryId(group.getSpendingCategoryId())
                .budgetStatus(worstBudgetStatus)
                .diaryStatus(worstDiaryStatus)
                .weeklyData(weeklyData)
                .build();
    }

    // 리포트 화면(report_service.py)과 동일한 주차 계산 로직
    // adjusted_first = 이번 달 1일의 요일(월=0, 일=6)
    // week_num = (day + adjusted_first - 1) / 7 + 1
    private List<WeekRange> getWeeksOfMonth(int year, int month, LocalDate today) {
        LocalDate firstDay = LocalDate.of(year, month, 1);
        int daysInMonth    = YearMonth.of(year, month).lengthOfMonth();
        int adjustedFirst  = firstDay.getDayOfWeek().getValue() - 1; // 월=0, 일=6
        int totalWeeks     = (daysInMonth + adjustedFirst - 1) / 7 + 1;

        List<WeekRange> weeks = new ArrayList<>();
        for (int w = 1; w <= totalWeeks; w++) {
            // 주차 시작/끝 날짜 (1일 기준, 범위를 달 내로 clamp)
            int startDay = (w - 1) * 7 - adjustedFirst + 1;
            int endDay   = w * 7 - adjustedFirst;

            LocalDate weekStart = firstDay.withDayOfMonth(Math.max(1, startDay));
            LocalDate weekEnd   = firstDay.withDayOfMonth(Math.min(daysInMonth, endDay));

            // 미래 주차는 오늘까지만 포함 (오늘 이후 시작하는 주차는 제외)
            if (weekStart.isAfter(today)) break;

            weeks.add(new WeekRange(
                    w + "주",
                    weekStart.format(DATE_FMT),
                    weekEnd.format(DATE_FMT),
                    weekStart.atStartOfDay(),
                    weekEnd.plusDays(1).atStartOfDay()
            ));
        }
        return weeks;
    }

    private String calcBudgetStatus(long spend, Integer target) {
        if (target == null || target <= 0) return "SAFE";
        double ratio = (double) spend / target;
        if (ratio >= 1.0)      return "DANGER";
        if (ratio >= 0.8)      return "WARNING";
        return "SAFE";
    }

    private String calcDiaryStatus(long count, Integer target) {
        if (target == null || target <= 0) return "SAFE";
        if (count == 0)                    return "DANGER";
        if ((double) count / target < 0.8) return "WARNING";
        return "SAFE";
    }

    private boolean isWorse(String a, String b) {
        return statusRank(a) > statusRank(b);
    }

    private int statusRank(String status) {
        if ("DANGER".equals(status))  return 2;
        if ("WARNING".equals(status)) return 1;
        return 0;
    }

    // 주차 날짜 범위 내부 클래스
    private static class WeekRange {
        final String label;
        final String startStr;
        final String endStr;
        final LocalDateTime startDt;
        final LocalDateTime endDt;

        WeekRange(String label, String startStr, String endStr, LocalDateTime startDt, LocalDateTime endDt) {
            this.label    = label;
            this.startStr = startStr;
            this.endStr   = endStr;
            this.startDt  = startDt;
            this.endDt    = endDt;
        }
    }
}
