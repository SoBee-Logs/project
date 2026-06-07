import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import ConsumptionLog from '../features/diary/ConsumptionLog'


const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('jwt-decode', () => ({
  jwtDecode: () => ({ sub: '1' })
}))

global.fetch = vi.fn()
global.localStorage = {
  getItem: vi.fn(() => 'fake-token'),
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[{ state: { myGroups: [], selectedRooms: [] } }]}>
      <ConsumptionLog />
    </MemoryRouter>
  )

// 1. 렌더링
test('소비 로그 페이지가 정상 렌더링된다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ photos: [] }),
  })
  renderPage()
  expect(screen.getByText('나의 소비 로그')).toBeInTheDocument()
})

// 2. 빈 상태 메시지
test('사진이 없으면 빈 상태 메시지가 표시된다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ photos: [] }),
  })
  renderPage()
  await waitFor(() => {
    expect(screen.getByText('해당 날짜의 소비 로그가 없어요')).toBeInTheDocument()
  })
})

// 3. 사진 목록 표시
test('사진이 있으면 목록이 표시된다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      photos: [
        { id: 1, url: 'http://test.com/img.jpg', time: '14:30', emoji: '😊', text: '커피', group: [], mapped: false }
      ]
    }),
  })
  renderPage()
  await waitFor(() => {
    expect(screen.getByText('커피')).toBeInTheDocument()
  })
})

// 4. 날짜 버튼 클릭 시 캘린더 표시
test('날짜 버튼 클릭 시 캘린더가 표시된다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ photos: [] }),
  })
  renderPage()
  fireEvent.click(screen.getByText(/2026년/))
  await waitFor(() => {
    expect(screen.getByText('취소')).toBeInTheDocument()
  })
})

// 5. 캘린더 취소 버튼
test('캘린더 취소 버튼 클릭 시 캘린더가 닫힌다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ photos: [] }),
  })
  renderPage()
  fireEvent.click(screen.getByText(/2026년/))
  await waitFor(() => screen.getByText('취소'))
  fireEvent.click(screen.getByText('취소'))
  await waitFor(() => {
    expect(screen.queryByText('취소')).not.toBeInTheDocument()
  })
})

// 6. LLM 일기 생성 버튼 존재
test('LLM 일기 생성 버튼이 존재한다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ photos: [] }),
  })
  renderPage()
  expect(screen.getByText(/LLM 일기 생성/)).toBeInTheDocument()
})

// 7. 매핑된 사진 배지 표시
test('매핑된 사진에 매핑됨 배지가 표시된다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      photos: [
        { id: 1, url: 'http://test.com/img.jpg', time: '14:30', emoji: '😊', text: '', group: [], mapped: true }
      ]
    }),
  })
  renderPage()
  await waitFor(() => {
    expect(screen.getByText(/매핑됨/)).toBeInTheDocument()
  })
})

// 8. LLM 일기 생성 버튼 클릭 시 /loading 으로 이동
test('LLM 일기 생성 버튼 클릭 시 loading 페이지로 이동한다', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ photos: [] }),
  })
  renderPage()
  await waitFor(() => {
    expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument()
  })
  fireEvent.click(screen.getByText(/LLM 일기 생성/))
  expect(mockNavigate).toHaveBeenCalledWith('/loading', expect.any(Object))
})