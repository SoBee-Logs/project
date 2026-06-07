import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// 이미지 import mock
vi.mock('../../../assets/image 61.png', () => ({ default: 'default-avatar.png' }))

// useAuth mock
vi.mock('../../../common/hooks/useAuth', () => ({
  getUserId: () => 1,
}))

// useNavigate mock
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import AvaterRoom from '../AvaterRoom'

// ──────────────────────────────────────────────
// 헬퍼: fetch mock 응답 구성
// ──────────────────────────────────────────────
const PERSONA_OK = {
  avatarName: '꿀벌 페르소나',
  avatarImgUrl: null,
  avatarExplain: '테스트 설명',
}

const TX_EMPTY = {
  payment_out: 0,
  payment_total_num: 0,
  category_transactions: {},
  weekly_avatar: {},
  weekly_category_price: {},
  weekly_timepattern_price: {},
  weekly_top_emotion: {},
  week_order: [],
}

const TX_WITH_AVATAR = {
  ...TX_EMPTY,
  payment_total_num: 3,
  payment_out: 50000,
  category_transactions: {
    식비: [{ payment_date: '2026-06-02', payment_time: '12:00', payment_place: '스타벅스', payment_out: 5000 }],
  },
  weekly_avatar: {
    '1주': {
      avatar_img_url: 'https://s3.example.com/avatar.png',
      avatar_name: '주간 꿀벌',
      avatar_explain: '이번 주 아바타',
      avatar_change_reason: null,
    },
  },
  weekly_category_price: { '1주': { 식비: 50000 } },
  weekly_timepattern_price: { '1주': { 점심: 50000 } },
  weekly_top_emotion: {},
}

function mockFetch(personaData, txData) {
  global.fetch = vi.fn((url) => {
    if (url.includes('/persona')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(personaData),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(txData),
    })
  })
}

function renderAvaterRoom() {
  return render(
    <MemoryRouter>
      <AvaterRoom />
    </MemoryRouter>
  )
}

// ──────────────────────────────────────────────
// 테스트
// ──────────────────────────────────────────────
describe('AvaterRoom', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── 1. 기본 이미지 렌더링 ──────────────────
  describe('기본 이미지 (아바타 없음)', () => {
    it('아바타 없을 때 기본 이미지가 렌더링된다', async () => {
      mockFetch(PERSONA_OK, TX_EMPTY)
      renderAvaterRoom()

      await waitFor(() => {
        const img = screen.getByAltText('기본 아바타')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', 'default-avatar.png')
      })
    })

    it('기본 이미지는 object-contain 클래스를 가진다', async () => {
      mockFetch(PERSONA_OK, TX_EMPTY)
      renderAvaterRoom()

      await waitFor(() => {
        const img = screen.getByAltText('기본 아바타')
        expect(img.className).toContain('object-contain')
      })
    })
  })

  // ── 2. 아바타 이미지 렌더링 ────────────────
  describe('아바타 이미지 (아바타 있음)', () => {
    it('weekly_avatar 있을 때 해당 이미지가 렌더링된다', async () => {
      mockFetch(PERSONA_OK, TX_WITH_AVATAR)
      renderAvaterRoom()

      await waitFor(() => {
        const img = screen.getByAltText('주간 꿀벌')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', 'https://s3.example.com/avatar.png')
      })
    })

    it('아바타 있을 때 기본 이미지는 렌더링되지 않는다', async () => {
      mockFetch(PERSONA_OK, TX_WITH_AVATAR)
      renderAvaterRoom()

      await waitFor(() => {
        expect(screen.queryByAltText('기본 아바타')).not.toBeInTheDocument()
      })
    })
  })

  // ── 3. 아바타명 표시 조건 ──────────────────
  describe('아바타명 표시 조건', () => {
    it('아바타 없을 때(hasWeekAvatar=false) 아바타명이 표시되지 않는다', async () => {
      mockFetch(PERSONA_OK, TX_EMPTY)
      renderAvaterRoom()

      await waitFor(() => {
        expect(screen.queryByText('꿀벌 페르소나')).not.toBeInTheDocument()
      })
    })

    it('아바타 있을 때 아바타명이 표시된다', async () => {
      mockFetch(PERSONA_OK, TX_WITH_AVATAR)
      renderAvaterRoom()

      await waitFor(() => {
        expect(screen.getAllByText('주간 꿀벌').length).toBeGreaterThan(0)
      })
    })
  })

  // ── 4. 빈 달 팝업 ──────────────────────────
  describe('빈 달 팝업 (EmptyMonthModal)', () => {
    it('연동 이전 달 이동 시 팝업이 렌더링된다', async () => {
      // 현재 달: 데이터 있음 → 이전 달: 빈 달
      let callCount = 0
      global.fetch = vi.fn((url) => {
        if (url.includes('/persona')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(PERSONA_OK) })
        }
        callCount++
        // 첫 번째(현재 달) 요청은 정상, 두 번째(이전 달) 요청은 빈 데이터
        const data = callCount === 1 ? TX_WITH_AVATAR : TX_EMPTY
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
      })

      renderAvaterRoom()
      await waitFor(() => screen.getByAltText('주간 꿀벌'))

      // 이전 달 이동
      const prevBtn = screen.getByLabelText('이전 달')
      await act(async () => { fireEvent.click(prevBtn) })

      await waitFor(() => {
        expect(screen.getByText('마이데이터 연동 이전 기간으로,')).toBeInTheDocument()
      })
    })

    it('팝업의 확인 버튼 클릭 시 팝업이 닫힌다', async () => {
      let callCount = 0
      global.fetch = vi.fn((url) => {
        if (url.includes('/persona')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(PERSONA_OK) })
        }
        callCount++
        const data = callCount === 1 ? TX_WITH_AVATAR : TX_EMPTY
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
      })

      renderAvaterRoom()
      await waitFor(() => screen.getByAltText('주간 꿀벌'))

      const prevBtn = screen.getByLabelText('이전 달')
      await act(async () => { fireEvent.click(prevBtn) })
      await waitFor(() => screen.getByText('마이데이터 연동 이전 기간으로,'))

      const confirmBtn = screen.getByText('확인')
      await act(async () => { fireEvent.click(confirmBtn) })

      await waitFor(() => {
        expect(screen.queryByText('마이데이터 연동 이전 기간으로,')).not.toBeInTheDocument()
      })
    })

    it('빈 달 팝업 노출 시 아바타명이 표시되지 않는다', async () => {
      let callCount = 0
      global.fetch = vi.fn((url) => {
        if (url.includes('/persona')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(PERSONA_OK) })
        }
        callCount++
        const data = callCount === 1 ? TX_WITH_AVATAR : TX_EMPTY
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
      })

      renderAvaterRoom()
      await waitFor(() => screen.getByAltText('주간 꿀벌'))

      const prevBtn = screen.getByLabelText('이전 달')
      await act(async () => { fireEvent.click(prevBtn) })

      await waitFor(() => {
        expect(screen.queryByText('주간 꿀벌')).not.toBeInTheDocument()
        expect(screen.queryByText('꿀벌 페르소나')).not.toBeInTheDocument()
      })
    })
  })

  // ── 5. 월 네비게이션 ───────────────────────
  describe('월 네비게이션', () => {
    it('현재 달일 때 다음 달 버튼이 비활성화된다', async () => {
      mockFetch(PERSONA_OK, TX_EMPTY)
      renderAvaterRoom()

      await waitFor(() => {
        const nextBtn = screen.getByLabelText('다음 달')
        expect(nextBtn).toBeDisabled()
      })
    })

    it('이전 달 버튼 클릭 시 월이 변경된다', async () => {
      mockFetch(PERSONA_OK, TX_EMPTY)
      renderAvaterRoom()

      const today = new Date()
      const currentMonth = `${today.getFullYear()}년 ${today.getMonth() + 1}월`
      await waitFor(() => screen.getByText(currentMonth))

      const prevBtn = screen.getByLabelText('이전 달')
      await act(async () => { fireEvent.click(prevBtn) })

      const prevMonth = today.getMonth() === 0
        ? `${today.getFullYear() - 1}년 12월`
        : `${today.getFullYear()}년 ${today.getMonth()}월`

      await waitFor(() => {
        expect(screen.getAllByText(prevMonth).length).toBeGreaterThan(0)
      })
    })
  })

  // ── 6. 주차 탭 ─────────────────────────────
  describe('주차 탭', () => {
    it('주차 탭 클릭 시 해당 주차가 선택된다', async () => {
      const txWithMultipleWeeks = {
        ...TX_WITH_AVATAR,
        category_transactions: {
          식비: [
            { payment_date: '2026-06-02', payment_time: '12:00', payment_place: 'A', payment_out: 5000 },
            { payment_date: '2026-06-09', payment_time: '12:00', payment_place: 'B', payment_out: 3000 },
          ],
        },
        weekly_avatar: {
          '1주': TX_WITH_AVATAR.weekly_avatar['1주'],
          '2주': {
            avatar_img_url: 'https://s3.example.com/avatar2.png',
            avatar_name: '2주 꿀벌',
            avatar_explain: '2주 아바타',
            avatar_change_reason: null,
          },
        },
      }
      mockFetch(PERSONA_OK, txWithMultipleWeeks)
      renderAvaterRoom()

      await waitFor(() => screen.getByText('2주'))

      await act(async () => { fireEvent.click(screen.getByText('2주')) })

      await waitFor(() => {
        expect(screen.getByText('2주').className).toContain('bg-white')
      })
    })
  })

  // ── 7. 확장/축소 토글 ──────────────────────
  describe('확장/축소 토글', () => {
    it('아바타 없을 때 이미지 영역 클릭해도 토글되지 않는다 (cursor-default)', async () => {
      mockFetch(PERSONA_OK, TX_EMPTY)
      renderAvaterRoom()

      await waitFor(() => screen.getByAltText('기본 아바타'))

      // hasWeekAvatar=false → cursor-default 클래스 적용
      const section = screen.getByAltText('기본 아바타').closest('section')
      expect(section.className).toContain('cursor-default')
    })

    it('아바타 있을 때 이미지 영역은 cursor-pointer 클래스를 가진다', async () => {
      mockFetch(PERSONA_OK, TX_WITH_AVATAR)
      renderAvaterRoom()

      await waitFor(() => screen.getByAltText('주간 꿀벌'))

      const section = screen.getByAltText('주간 꿀벌').closest('section')
      expect(section.className).toContain('cursor-pointer')
    })
  })

  // ── 8. 소비 리포트 버튼 ────────────────────
  describe('소비 리포트 버튼', () => {
    it('소비 리포트 보기 버튼 클릭 시 /report/monthly 로 이동한다', async () => {
      mockFetch(PERSONA_OK, TX_WITH_AVATAR)
      renderAvaterRoom()

      await waitFor(() => screen.getByText('소비 리포트 보기'))

      await act(async () => {
        fireEvent.click(screen.getByText('소비 리포트 보기'))
      })

      expect(mockNavigate).toHaveBeenCalledWith('/report/monthly')
    })
  })

  // ── 9. 로딩 상태 ───────────────────────────
  describe('로딩 상태', () => {
    it('데이터 로딩 중 로딩 인디케이터가 표시된다', async () => {
      // fetch가 resolve되기 전 상태를 캡처
      global.fetch = vi.fn(() => new Promise(() => {})) // 영구 pending

      renderAvaterRoom()

      expect(screen.getByText('불러오는 중...')).toBeInTheDocument()
    })
  })
})
