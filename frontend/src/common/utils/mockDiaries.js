import { CURRENT_USER, ROOMS } from '../constants/rooms'

const PASTA_IMAGE =
  'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80'

export const mockDiaries = [
  {
    id: '1',
    imageUrl: PASTA_IMAGE,
    title: '과소비한 날',
    diaryLines: [
      '오늘은 진짜 너무 썼다. 점심에 고기 먹고, 카페 들렀다가, 저녁엔 또 배달까지 시켰으니.',
      '지갑이 울고 있을 것 같은데 배는 행복했으니 됐다. 내일부터 진짜 아껴야지...',
    ],
    subtitle: '오늘 많이 먹었다~',
    authorNickname: '시원',
    personaTitle: '야행성 도시 탐험가',
    avatarUrl: CURRENT_USER.avatarUrl,
    date: '2024.10.30 20:30',
    location: '서촌 포인트',
    likes: 12,
    liked: false,
    roomId: 'room1',
  },
  {
    id: '2',
    imageUrl:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
    title: '점심 회식',
    diaryLines: ['팀 회식으로 피자 한 판.', '바쁜 월요일도 맛있으면 괜찮다.'],
    subtitle: '회식 데이',
    authorNickname: '준호',
    personaTitle: '오피스 미식가',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80',
    date: '2024.10.29 12:30',
    location: '강남역',
    likes: 18,
    liked: true,
    roomId: 'room1',
  },
  {
    id: '3',
    imageUrl:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
    title: '브런치',
    diaryLines: ['주말 브런치, 햇살 가득.', '여유로운 아침.'],
    subtitle: '브런치 타임',
    authorNickname: '수연',
    personaTitle: '브런치 러버',
    avatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80',
    date: '2024.10.28 10:00',
    location: '한남동',
    likes: 41,
    liked: false,
    roomId: 'room2',
  },
]

/** 홈 피드: 방별 최신 사진 */
export const roomFeedPreviews = ROOMS.map((room, i) => ({
  roomId: room.id,
  roomName: room.label,
  imageUrl: mockDiaries[i % mockDiaries.length]?.imageUrl ?? PASTA_IMAGE,
}))

/** 오늘 소비 로그 타임라인 */
export const todayConsumptionLogs = [
  {
    id: 'log-1',
    time: '07 : 33',
    text: '스타벅스 커피',
    mood: '😡',
    roomTags: ['#다이어트', '#거지방'],
    thumbnail: PASTA_IMAGE,
  },
  {
    id: 'log-2',
    time: '12 : 15',
    text: '점심 파스타',
    mood: '😍',
    roomTags: ['#모임1'],
    thumbnail:
      'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80',
  },
  {
    id: 'log-3',
    time: '18 : 42',
    text: '저녁 배달',
    mood: '😲',
    roomTags: ['#모임1', '#모임2'],
    thumbnail:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
    isLatest: true,
  },
]

const ROOM_DIARY_VARIANTS = {
  room1: {
    title: '과소비한 날',
    subtitle: '오늘 많이 먹었다~',
    diaryLines: [
      '오늘은 진짜 너무 썼다. 점심에 고기 먹고, 카페 들렀다가, 저녁엔 또 배달까지 시켰으니.',
      '지갑이 울고 있을 것 같은데 배는 행복했으니 됐다. 내일부터 진짜 아껴야지...',
    ],
  },
  room2: {
    title: '다이어트 실패',
    subtitle: '오늘은 치팅데이...',
    diaryLines: [
      '샐러드 대신 치킨을 시켜버렸다. 내일부터 다시 시작해야지.',
      '친구들이랑 모임에서 분위기 탓에 한 입이 아니라 한 판.',
      '다이어트는 내일부터—오늘은 행복했다.',
    ],
  },
  room3: {
    title: '소소한 소비',
    subtitle: '기분 전환',
    diaryLines: [
      '작은 선물 하나 샀다.',
      '금액은 작아도 기분은 컸다.',
      '나를 위한 소비, 나쁘지 않아.',
    ],
  },
}

export function getGeneratedDiary(overrides = {}) {
  const roomId = overrides.roomId ?? 'room1'
  const variant = ROOM_DIARY_VARIANTS[roomId] ?? ROOM_DIARY_VARIANTS.room1
  const room = ROOMS.find((r) => r.id === roomId)

  return {
    id: `generated-${roomId}-${Date.now()}`,
    imageUrl: overrides.imageUrl ?? PASTA_IMAGE,
    title: variant.title,
    subtitle: variant.subtitle,
    diaryLines: variant.diaryLines,
    authorNickname: CURRENT_USER.nickname,
    personaTitle: CURRENT_USER.personaTitle,
    avatarUrl: CURRENT_USER.avatarUrl,
    date: '2024.10.30 20:30',
    location: '서촌 포인트',
    likes: 0,
    liked: false,
    roomId,
    roomLabel: room?.diaryTab ?? room?.label,
    isNew: true,
    ...overrides,
  }
}

export function getDiariesForRooms(roomIds, baseOverrides = {}) {
  return roomIds.map((roomId) => getGeneratedDiary({ roomId, ...baseOverrides }))
}
