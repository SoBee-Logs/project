import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import CameraPage from '../features/camera/CameraPage'

// 네비게이션 mock
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

// GPS mock
const mockGeolocation = {
  getCurrentPosition: vi.fn((success) =>
    success({ coords: { latitude: 37.5665, longitude: 126.9780 } })
  ),
}
global.navigator.geolocation = mockGeolocation

// fetch mock
global.fetch = vi.fn()

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[{ state: { myGroups: [{ groupId: 1, groupName: '테스트모임' }] } }]}>
      <CameraPage />
    </MemoryRouter>
  )

// 1. 페이지 렌더링
test('카메라 페이지가 정상 렌더링된다', () => {
  renderPage()
  expect(screen.getByPlaceholderText('사진에 대해 설명해주세요!')).toBeInTheDocument()
})

// 2. 다음 버튼 비활성화
test('사진과 모임 미선택 시 다음 버튼이 비활성화된다', () => {
  renderPage()
  const btn = screen.getByText('다음')
  expect(btn).toBeDisabled()
})

// 3. 모임 선택
test('모임을 선택하면 체크 표시가 나타난다', () => {
  renderPage()
  const roomBtn = screen.getByText('테스트모임')
  fireEvent.click(roomBtn)
  expect(screen.getByText('✓')).toBeInTheDocument()
})

// 4. VLM 분석 결과 표시
test('VLM 분석 완료 시 결과 카드가 표시된다', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      category: '카페간식',
      price: 5000,
      _elapsed_ms: 1200,
    }),
  })

  renderPage()

  const input = document.querySelector('input[type="file"]')
  const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' })
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => {
    expect(screen.getByText('카페간식')).toBeInTheDocument()
  })
})

// 5. 응답 시간 표시
test('VLM 응답 시간이 표시된다', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      category: '식비',
      price: 10000,
      _elapsed_ms: 2000,
    }),
  })

  renderPage()

  const input = document.querySelector('input[type="file"]')
  const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' })
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => {
    expect(screen.getByText('2000ms')).toBeInTheDocument()
  })
})