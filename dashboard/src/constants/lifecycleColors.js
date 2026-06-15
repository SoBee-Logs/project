// 생애주기별 고정 색상 — 모든 차트에서 같은 생애주기는 같은 색으로 표시한다.
export const LIFECYCLE_COLORS = {
  TEEN: '#f59e0b',        // 십대
  UNI: '#6c63ff',         // 대학생
  NEW_JOB: '#0ea5e9',     // 사회초년생
  NEW_WED: '#ec4899',     // 신혼
  CHILD_BABY: '#10b981',  // 자녀영유아
  CHILD_TEEN: '#14b8a6',  // 자녀의무교육
  CHILD_UNI: '#8b5cf6',   // 자녀대학생
  GOLLIFE: '#f97316',     // 중년기타
  SECLIFE: '#a855f7',     // 2nd Life
  RETIR: '#ef4444',       // 은퇴
}

const UNCLASSIFIED = '#cbd5e1'

// 생애주기 코드로 고정 색을 반환. 매핑에 없으면(미분류) 회색.
export function lifecycleColor(code) {
  return LIFECYCLE_COLORS[code] || UNCLASSIFIED
}
