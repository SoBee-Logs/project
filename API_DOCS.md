# SoBee API 문서

> **Spring Boot** (`:8080`) + **FastAPI** (`:8000`)
> 공통 인증: Spring → `Authorization: Bearer <JWT>` / FastAPI 내부 API → `X-Internal-Secret` 헤더

---

## Spring Boot

---

### 👤 User

<details>
<summary>POST /api/users/register — 회원가입</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| name | 사용자 이름 | String | | x | `홍길동` |
| email | 이메일 주소 | String | | x | `user@example.com` |
| gender | 성별 | String | | x | `M` / `F` |
| age | 나이 | Integer | | x | `25` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| - | 성공 메시지 | String | | x | `회원가입 성공` |

**Example**

```json
"회원가입 성공"
```

### Status

| status | response content |
| --- | --- |
| 200 | 회원가입 성공 |
| 400 | 필수 파라미터 누락 |

</details>

---

<details>
<summary>POST /api/users/login — 로그인</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| email | 이메일 주소 | String | | x | `user@example.com` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| token | JWT 액세스 토큰 | String | | x | `eyJhbGci...` |

**Example**

```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 로그인 성공, JWT 반환 |
| 400 | 이메일 누락 또는 존재하지 않는 유저 |

</details>

---

<details>
<summary>GET /api/users/{userId}/persona — 유저 페르소나 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| userId | 사용자 ID | BIGINT | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| avatarName | 아바타 이름 | String | | x | `절약왕 길동` |
| avatarExplain | 아바타 설명 | String | | x | `커피를 사랑하는 ...` |
| avatarImgUrl | 아바타 이미지 S3 URL | String | | o | `https://s3.amazonaws.com/...` |
| avatarChangeReason | 아바타 변경 이유 | String | | o | `카페 소비가 늘었어요` |
| createdAt | 생성 일시 | String | | x | `2026-06-07T14:30:00` |

**Example**

```json
{
    "avatarName": "절약왕 길동",
    "avatarExplain": "커피를 사랑하는 절약형 소비자",
    "avatarImgUrl": "https://s3.amazonaws.com/sobee/avatars/1.png",
    "avatarChangeReason": "카페 소비가 늘었어요",
    "createdAt": "2026-06-07T14:30:00"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 페르소나 조회 성공 |
| 404 | 해당 유저 없음 |

</details>

---

<details>
<summary>DELETE /api/users/{userId} — 회원 탈퇴</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| userId | 사용자 ID | BIGINT | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| - | 결과 메시지 | String | | x | `회원 탈퇴 완료` |

**Example**

```json
"회원 탈퇴 완료"
```

### Status

| status | response content |
| --- | --- |
| 200 | 탈퇴 완료 (is_active = false, soft delete) |
| 404 | 해당 유저 없음 |

</details>

---

### 👥 Group

<details>
<summary>POST /api/groups — 모임 생성</summary>

**Content-Type:** `application/json`
**Auth:** `Authorization: Bearer <JWT>`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupName | 모임 이름 | String | | x | `카페 거지방` |
| groupDescription | 모임 설명 | String | | x | `커피값 아끼기` |
| category | 방 테마 카테고리 | String (enum) | optional | o | `FOOD` |
| targetBudget | 주간 소비 목표 금액 (원) | Integer | optional | o | `50000` |
| targetDiaryCount | 주간 일기 목표 횟수 | Integer | optional | o | `3` |

> category 값: `EXERCISE` / `HOBBY` / `TRAVEL` / `FAMILY` / `DAILY` / `FOOD` / `PET`

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 생성된 모임 ID | BIGINT | | x | `5` |
| groupName | 모임 이름 | String | | x | `카페 거지방` |
| groupDescription | 모임 설명 | String | | x | `커피값 아끼기` |
| groupCode | 초대 코드 | String | | x | `AB12CD` |
| category | 방 테마 카테고리 | String (enum) | | o | `FOOD` |
| targetBudget | 주간 소비 목표 금액 (원) | Integer | | o | `50000` |
| targetDiaryCount | 주간 일기 목표 횟수 | Integer | | o | `3` |

**Example**

```json
{
    "groupId": 5,
    "groupName": "카페 거지방",
    "groupDescription": "커피값 아끼기",
    "groupCode": "AB12CD",
    "category": "FOOD",
    "targetBudget": 50000,
    "targetDiaryCount": 3
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 모임 생성 성공 |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>POST /api/groups/join — 초대코드로 모임 참가</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| code | 모임 초대 코드 | String | | x | `AB12CD` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 참가한 모임 ID | BIGINT | | x | `5` |
| groupName | 모임 이름 | String | | x | `카페 거지방` |
| groupDescription | 모임 설명 | String | | x | `커피값 아끼기` |
| groupCode | 초대 코드 | String | | x | `AB12CD` |
| category | 방 테마 카테고리 | String (enum) | | o | `FOOD` |
| targetBudget | 주간 소비 목표 금액 (원) | Integer | | o | `50000` |
| targetDiaryCount | 주간 일기 목표 횟수 | Integer | | o | `3` |

**Example**

```json
{
    "groupId": 5,
    "groupName": "카페 거지방",
    "groupDescription": "커피값 아끼기",
    "groupCode": "AB12CD",
    "category": "FOOD",
    "targetBudget": 50000,
    "targetDiaryCount": 3
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 모임 참가 성공 |
| 404 | 존재하지 않는 코드 |
| 409 | 이미 참여 중인 모임 |

</details>

---

<details>
<summary>GET /api/groups — 내 모임 목록 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 모임 목록 | List\<GroupResponseDto\> | | x | |
| [].groupId | 모임 ID | BIGINT | | x | `5` |
| [].groupName | 모임 이름 | String | | x | `카페 거지방` |
| [].groupDescription | 모임 설명 | String | | x | `커피값 아끼기` |
| [].groupCode | 초대 코드 | String | | x | `AB12CD` |
| [].category | 방 테마 카테고리 | String (enum) | | o | `FOOD` |
| [].targetBudget | 주간 소비 목표 금액 (원) | Integer | | o | `50000` |
| [].targetDiaryCount | 주간 일기 목표 횟수 | Integer | | o | `3` |

**Example**

```json
[
    {
        "groupId": 5,
        "groupName": "카페 거지방",
        "groupDescription": "커피값 아끼기",
        "groupCode": "AB12CD",
        "category": "FOOD",
        "targetBudget": 50000,
        "targetDiaryCount": 3
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 모임 목록 반환 (없으면 빈 배열) |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>DELETE /api/groups/{groupId}/leave — 모임 탈퇴</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 탈퇴할 모임 ID | BIGINT | | x | `5` |

### Response

없음 (body 없이 200 반환)

### Status

| status | response content |
| --- | --- |
| 200 | 탈퇴 성공 |
| 401 | JWT 없음 또는 유효하지 않음 |
| 404 | 해당 모임 없음 |

</details>

---

### 📸 Photo

<details>
<summary>POST /api/photos — 사진 업로드</summary>

**Content-Type:** `multipart/form-data`
**Auth:** `Authorization: Bearer <JWT>`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| image | 업로드할 이미지 파일 | MultipartFile | | x | (binary) |
| takenAt | 사진 촬영 일시 | String (ISO 8601) | | x | `2026-06-07T14:30:00` |
| latitude | 위도 | String (Double) | | x | `37.5665` |
| longitude | 경도 | String (Double) | | x | `126.9780` |
| text | 사용자 메모 (최대 50자) | String | optional | o | `오늘 진짜 맛있었다` |
| emoji | 감정 이모지 | String | optional | o | `😍` |
| groupId | 공유할 그룹 ID 목록 (콤마 구분) | String | optional | o | `1,3,5` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| photoId | 생성된 사진 ID | BIGINT | | x | `42` |
| imageUrl | S3 업로드된 이미지 URL | String | | x | `https://s3.amazonaws.com/...` |
| takenAt | 촬영 일시 | LocalDateTime | | x | `2026-06-07T14:30:00` |
| createdAt | 서버 저장 일시 | LocalDateTime | | x | `2026-06-07T14:31:05` |

**Example**

```json
{
    "photoId": 42,
    "imageUrl": "https://s3.amazonaws.com/sobee/photos/42.jpg",
    "takenAt": "2026-06-07T14:30:00",
    "createdAt": "2026-06-07T14:31:05"
}
```

### Status

| status | response content |
| --- | --- |
| 201 | 사진 업로드 성공 |
| 400 | text 50자 초과 / 필수 파라미터 누락 |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>GET /api/photos — 날짜별 사진 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| date | 조회 날짜 | String (yyyy-MM-dd) | | x | `2026-06-07` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| photos | 사진 목록 | List\<PhotoResponse\> | | x | |
| photos[].id | 사진 ID | BIGINT | | x | `42` |
| photos[].url | 이미지 URL | String | | x | `https://s3.amazonaws.com/...` |
| photos[].date | 날짜 | String (yyyy-MM-dd) | | x | `2026-06-07` |
| photos[].time | 시간 | String (HH:mm) | | x | `14:30` |
| photos[].emoji | 감정 이모지 | String | | o | `😍` |
| photos[].text | 메모 | String | | o | `오늘 진짜 맛있었다` |
| photos[].group | 공유된 그룹 ID 목록 | List\<Long\> | | o | `[1, 3]` |
| photos[].mapped | 결제 내역 매핑 성공 여부 | Boolean | | x | `true` |

**Example**

```json
{
    "photos": [
        {
            "id": 42,
            "url": "https://s3.amazonaws.com/sobee/photos/42.jpg",
            "date": "2026-06-07",
            "time": "14:30",
            "emoji": "😍",
            "text": "오늘 진짜 맛있었다",
            "group": [1, 3],
            "mapped": true
        }
    ]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 사진 목록 반환 (없으면 빈 배열) |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>GET /api/photos/group/{groupId}/latest — 그룹 최신 사진 URL 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 그룹 ID | BIGINT | | x | `5` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| imageUrl | 가장 최신 사진 URL | String | | o | `https://s3.amazonaws.com/...` |

**Example**

```json
{
    "imageUrl": "https://s3.amazonaws.com/sobee/photos/42.jpg"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 최신 사진 URL 반환 (없으면 imageUrl: null) |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>POST /api/photos/{photoId}/vlm-result — VLM 분석 결과 저장</summary>

**Content-Type:** `application/json`
**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| photoId | 사진 ID | BIGINT | | x | `42` |

**Body**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| category | 소비 카테고리 | String | | o | `카페간식` |
| item_name | 품목명 | String | | o | `아이스 아메리카노` |
| price | 추정 가격 (원) | Double | | o | `4500` |
| location_type | 가게 유형 | String | | o | `카페` |
| store_name | 가게 이름 | String | | o | `스타벅스` |
| description | 사진 한 줄 설명 | String | | o | `카페에서 찍은 음료 사진` |
| confidence | 분석 신뢰도 | String | | o | `high` / `medium` / `low` |
| address | 역지오코딩 주소 | String | | o | `서울시 강남구 ...` |
| taken_at | 실제 촬영 일시 (EXIF 기반) | String | | o | `2026-06-07T14:30:00` |
| groups | VLM groups 배열 (JSON) | Object | | o | `[{"group_id":1,...}]` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| vlmId | 저장된 VLM 결과 ID | BIGINT | | x | `10` |
| photoId | 연결된 사진 ID | BIGINT | | x | `42` |

**Example**

```json
{
    "vlmId": 10,
    "photoId": 42
}
```

### Status

| status | response content |
| --- | --- |
| 201 | VLM 결과 저장 성공 |
| 401 | JWT 없음 또는 유효하지 않음 |
| 404 | 해당 사진 없음 |

</details>

---

<details>
<summary>GET /api/photos/{photoId}/mapping — 사진-결제내역 매핑 결과 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| photoId | 사진 ID | BIGINT | | x | `42` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 매핑 결과 목록 | List\<Map\> | | x | |
| [].payment_id | 결제 내역 ID | Integer | | o | `201` |
| [].store | 가게명 | String | | o | `스타벅스` |
| [].amount | 결제 금액 (원) | Integer | | o | `4500` |

**Example**

```json
[
    {
        "payment_id": 201,
        "store": "스타벅스",
        "amount": 4500
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 매핑 결과 반환 |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

### 📔 Diary

<details>
<summary>POST /api/diary/generate — AI 일기 생성</summary>

**Content-Type:** `application/json`
**Auth:** `Authorization: Bearer <JWT>`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 대상 모임방 ID | BIGINT | | x | `5` |
| date | 조회 날짜 | String (yyyy-MM-dd) | | x | `2026-06-07` |
| mood | 소비 기분 이모지 | String | | o | `😍` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| title | 일기 제목 (AI 생성) | String | | x | `오늘도 스벅 🤣` |
| subtitle | 한 줄 요약 (AI 생성) | String | | x | `또 질렀다 ㅠ` |
| diaryLines | 일기 본문 (AI 생성) | List\<String\> | | x | |
| tags | 해시태그 목록 | List\<String\> | | x | `["#거지방"]` |
| roomId | 모임방 ID | BIGINT | | x | `5` |
| roomLabel | 모임방 이름 | String | | x | `카페 거지방` |
| imageUrls | 일기에 쓰인 사진 URL 목록 | List\<String\> | | x | |
| photoIds | 사진 ID 목록 | List\<Long\> | | x | `[42, 43]` |
| matchedPhotoIds | 결제 매핑 성공한 사진 ID 목록 | List\<Long\> | | x | `[42]` |

**Example**

```json
{
    "title": "오늘도 스벅 🤣",
    "subtitle": "또 질렀다 ㅠ",
    "diaryLines": [
        "아니 오늘 아아 없었으면 진짜 기절각이었음 ㅠㅠ",
        "스벅 들어가는 순간 지갑이 먼저 열렸다 ㅋㅋ"
    ],
    "tags": ["#거지방", "#카페"],
    "roomId": 5,
    "roomLabel": "카페 거지방",
    "imageUrls": ["https://s3.amazonaws.com/sobee/photos/42.jpg"],
    "photoIds": [42],
    "matchedPhotoIds": [42]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 일기 생성 성공 |
| 400 | groupId 또는 date 누락 |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>POST /api/diary/save — 일기 저장</summary>

**Content-Type:** `application/json`
**Auth:** `Authorization: Bearer <JWT>`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 저장할 모임방 ID | BIGINT | | x | `5` |
| diaryContent | JSON 직렬화된 일기 내용 | String (JSON) | | x | `{"title":"...","subtitle":"...","lines":[...]}` |
| photoIds | diary_photos에 연결할 사진 ID 목록 | List\<Long\> | | x | `[42, 43]` |

### Response

없음 (body 없이 201 반환)

### Status

| status | response content |
| --- | --- |
| 201 | 일기 저장 성공 |
| 400 | 필수 파라미터 누락 |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>GET /api/diary/list — 그룹 일기 피드 목록 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| groupId | 조회할 모임방 ID | BIGINT | | x | `5` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 일기 목록 | List\<DiaryFeedItemResponse\> | | x | |
| [].diaryId | 일기 ID | BIGINT | | x | `7` |
| [].title | 일기 제목 | String | | x | `오늘도 스벅 🤣` |
| [].subtitle | 한 줄 요약 | String | | x | `또 질렀다 ㅠ` |
| [].diaryLines | 일기 본문 줄 목록 | List\<String\> | | x | |
| [].date | 생성 날짜 | String (yyyy-MM-dd) | | x | `2026-06-07` |
| [].time | 생성 시간 | String (HH:mm) | | x | `14:31` |
| [].authorName | 작성자 이름 | String | | x | `홍길동` |
| [].authorId | 작성자 userId | BIGINT | | x | `1` |
| [].imageUrls | 연결된 사진 URL 전체 목록 | List\<String\> | | x | |
| [].imageUrl | 대표 사진 URL | String | | o | `https://s3.amazonaws.com/...` |
| [].roomId | 모임방 ID | BIGINT | | x | `5` |
| [].roomLabel | 모임방 이름 | String | | x | `카페 거지방` |
| [].likes | 좋아요 수 | Integer | | x | `3` |
| [].photoIds | 사진 ID 목록 | List\<Long\> | | x | `[42]` |
| [].matchedPhotoIds | 결제 매핑된 사진 ID 목록 | List\<Long\> | | x | `[42]` |

**Example**

```json
[
    {
        "diaryId": 7,
        "title": "오늘도 스벅 🤣",
        "subtitle": "또 질렀다 ㅠ",
        "diaryLines": ["아니 오늘 아아 없었으면 진짜 기절각이었음 ㅠㅠ"],
        "date": "2026-06-07",
        "time": "14:31",
        "authorName": "홍길동",
        "authorId": 1,
        "imageUrls": ["https://s3.amazonaws.com/sobee/photos/42.jpg"],
        "imageUrl": "https://s3.amazonaws.com/sobee/photos/42.jpg",
        "roomId": 5,
        "roomLabel": "카페 거지방",
        "likes": 3,
        "photoIds": [42],
        "matchedPhotoIds": [42]
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 일기 목록 반환 (없으면 빈 배열) |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

<details>
<summary>PUT /api/diary/{diaryId}/like — 일기 좋아요 토글</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| diaryId | 일기 ID | BIGINT | | x | `7` |

### Response

없음 (body 없이 200 반환)

### Status

| status | response content |
| --- | --- |
| 200 | 좋아요 토글 성공 |
| 401 | JWT 없음 또는 유효하지 않음 |
| 404 | 해당 일기 없음 |

</details>

---

### 📊 Report

<details>
<summary>GET /api/report/alert — 주간 목표 달성 현황 조회</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | AlertBoard 목록 | List\<AlertBoardResponse\> | | x | |
| [].groupId | 모임방 ID | BIGINT | | x | `5` |
| [].groupName | 모임방 이름 | String | | x | `카페 거지방` |
| [].budgetStatus | 소비 목표 달성 상태 | String (enum) | | x | `SAFE` / `WARNING` / `DANGER` |
| [].weeklySpend | 이번 주 실제 소비 합계 (원) | BIGINT | | x | `32000` |
| [].targetBudget | 목표 예산 (원) | Integer | | o | `50000` |
| [].diaryStatus | 일기 목표 달성 상태 | String (enum) | | x | `SAFE` / `WARNING` / `DANGER` |
| [].weeklyDiaryCount | 이번 주 실제 일기 수 | BIGINT | | x | `2` |
| [].targetDiaryCount | 목표 일기 횟수 | Integer | | o | `3` |

**Example**

```json
[
    {
        "groupId": 5,
        "groupName": "카페 거지방",
        "budgetStatus": "WARNING",
        "weeklySpend": 32000,
        "targetBudget": 50000,
        "diaryStatus": "SAFE",
        "weeklyDiaryCount": 2,
        "targetDiaryCount": 3
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | AlertBoard 목록 반환 |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

### 🏦 MyData

<details>
<summary>GET /api/accounts/available — 연동 가능 기관 코드 목록 조회</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| bank_codes | 연동 가능 은행 코드 목록 | List\<String\> | | x | `["0020", "0011"]` |
| card_codes | 연동 가능 카드사 코드 목록 | List\<String\> | | x | `["0301", "0309"]` |

**Example**

```json
{
    "bank_codes": ["0020", "0011"],
    "card_codes": ["0301", "0309"]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 기관 코드 목록 반환 |
| 500 | FastAPI 연결 실패 |

</details>

---

<details>
<summary>POST /api/accounts/register — 기관 등록 + 거래내역 sync 트리거</summary>

**Content-Type:** `application/json`
**Auth:** `Authorization: Bearer <JWT>`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| bankCodes | 등록할 은행 코드 목록 | List\<String\> | | x | `["0020"]` |
| cardCodes | 등록할 카드사 코드 목록 | List\<String\> | | x | `["0301"]` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| registered | 등록 성공한 기관 코드 목록 | List\<String\> | | x | `["0020", "0301"]` |
| missing | ENV에 없어서 등록 실패한 코드 목록 | List\<String\> | | x | `[]` |
| message | 처리 결과 메시지 | String | | x | `2개 기관 등록 완료. 30일 sync 시작.` |

**Example**

```json
{
    "user_id": 1,
    "registered": ["0020", "0301"],
    "missing": [],
    "message": "2개 기관 등록 완료. 30일 sync 시작."
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 기관 등록 성공 및 sync 트리거 |
| 400 | ENV에 없는 기관 코드 포함 |
| 401 | JWT 없음 또는 유효하지 않음 |
| 500 | FastAPI 연결 실패 |

</details>

---

<details>
<summary>GET /api/accounts/sync-status — sync 완료 여부 확인 (폴링용)</summary>

**Auth:** `Authorization: Bearer <JWT>`

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| synced | 거래내역 sync 완료 여부 | Boolean | | x | `true` |
| transaction_count | 적재된 거래내역 수 | Integer | | x | `87` |

**Example**

```json
{
    "synced": true,
    "transaction_count": 87
}
```

### Status

| status | response content |
| --- | --- |
| 200 | sync 상태 반환 (실패 시에도 synced: false로 200 반환) |
| 401 | JWT 없음 또는 유효하지 않음 |

</details>

---

### 💳 금융상품

<details>
<summary>POST /api/search — AI 금융상품 검색</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| search_input | 검색 쿼리 | String | | x | `카페 혜택 좋은 카드` |
| user_id | 사용자 ID | BIGINT | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| AI_text | AI 분석 텍스트 | String | | x | `카페 혜택이 좋은 카드를 추천드려요` |
| products | 검색된 상품 목록 | List\<ProductDto\> | | x | |
| products[].product_name | 상품명 | String | | x | `신한 카페 카드` |
| products[].product_company | 카드사/금융사 | String | | x | `신한카드` |
| products[].product_img_url | 상품 이미지 URL | String | | o | `https://...` |
| products[].product_type | 상품 유형 | String | | x | `card` / `savings` / `insurance` |
| products[].is_discontinued | 단종 여부 | Boolean | | o | `false` |
| products[].content | 상품 상세 정보 | ContentDto | | o | |
| matched_cate_names | 매칭된 카테고리 이름 목록 | List\<String\> | | x | `["카페간식"]` |

**Example**

```json
{
    "AI_text": "카페 혜택이 좋은 카드를 추천드려요",
    "products": [
        {
            "product_name": "신한 카페 카드",
            "product_company": "신한카드",
            "product_img_url": "https://...",
            "product_type": "card",
            "is_discontinued": false,
            "content": {
                "header": "카페 10% 할인",
                "middle": "월 최대 5,000원",
                "annualFeeDetail": "15,000원"
            }
        }
    ],
    "matched_cate_names": ["카페간식"]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 검색 결과 반환 |
| 400 | 필수 파라미터 누락 |

</details>

---

<details>
<summary>GET /api/search/recom_question — 추천 질문 목록 조회</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 추천 질문 목록 | List\<String\> | | x | |

**Example**

```json
[
    "실적 채울 카드 추천해줘",
    "내 패턴에 맞는 카드",
    "나 여행 갈 건데 어떤 트래블 카드 써야 해?",
    "카페 혜택 좋은 카드는 뭐야?"
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 추천 질문 목록 반환 |

</details>

---

<details>
<summary>GET /api/search/recent_question — 최근 질문 목록 조회</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 최근 질문 목록 | List\<String\> | | x | |

**Example**

```json
[
    "카페 혜택 좋은 카드는 뭐야?",
    "이번 달 카드 실적 얼마나 남았어?"
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 최근 질문 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/search — 자연어 통합 검색 (Elasticsearch)</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| q | 검색 쿼리 | String | | x | `신한 여행 카드` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| keyword | 검색 키워드 | String | | x | `신한 여행 카드` |
| totalCount | 전체 검색 결과 수 | Integer | | x | `5` |
| cards | 카드 검색 결과 목록 | List\<CardResult\> | | x | |
| savings | 예적금 검색 결과 목록 | List\<SavingsResult\> | | x | |
| insurance | 보험 검색 결과 목록 | List\<InsuranceResult\> | | x | |

**Example**

```json
{
    "keyword": "신한 여행 카드",
    "totalCount": 3,
    "cards": [
        {
            "cardInfoId": 10,
            "cardName": "신한 트래블리 카드",
            "corpName": "신한카드",
            "cardType": "신용",
            "annualFeeBasic": "15,000원",
            "cardImgUrl": "https://...",
            "isDiscontinued": false
        }
    ],
    "savings": [],
    "insurance": []
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 검색 결과 반환 |
| 400 | q 파라미터 누락 |

</details>

---

<details>
<summary>GET /api/financial-products/catalog — 상품 카탈로그 조회 (추천 질문 생성용)</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| cards | 현행 카드 이름 목록 (최대 20개) | List\<String\> | | x | `["신한 카페 카드", ...]` |
| savings | 예적금 상품 이름 목록 (최대 15개) | List\<String\> | | x | `["KB 스타 적금", ...]` |
| insurance | 미니보험 상품 이름 목록 | List\<String\> | | x | `["여행자 보험", ...]` |

**Example**

```json
{
    "cards": ["신한 카페 카드", "KB국민 트래블러스"],
    "savings": ["KB 스타 적금"],
    "insurance": ["여행자 보험"]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 카탈로그 반환 |

</details>

---

<details>
<summary>POST /api/financial-products/savings/sync — 예적금 데이터 DB 적재</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| status | 처리 상태 | String | | x | `success` |
| synced | 적재된 상품 수 | Integer | | x | `120` |

**Example**

```json
{
    "status": "success",
    "synced": 120
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 예적금 데이터 적재 완료 |

</details>

---

<details>
<summary>GET /api/financial-products/savings — 전체 예적금 조회</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 예적금 상품 목록 | List\<SavingsProduct\> | | x | |
| [].finPrdtNm | 상품명 | String | | x | `KB 스타 적금` |
| [].korCoNm | 금융사명 | String | | x | `국민은행` |
| [].intrRate | 기본 금리 | BigDecimal | | o | `3.50` |
| [].intrMaxRate | 최고 금리 | BigDecimal | | o | `4.20` |
| [].saveTrm | 저축 기간 (개월) | Integer | | o | `12` |

**Example**

```json
[
    {
        "finPrdtNm": "KB 스타 적금",
        "korCoNm": "국민은행",
        "intrRate": 3.50,
        "intrMaxRate": 4.20,
        "saveTrm": 12
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 예적금 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/savings/top — 금리 상위 예적금 조회</summary>

### Request

없음

### Response

전체 예적금 조회와 동일한 구조, 최고 금리 기준 상위 10개 반환

### Status

| status | response content |
| --- | --- |
| 200 | 상위 10개 예적금 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/savings/search — 예적금 키워드 검색</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| keyword | 검색 키워드 | String | | x | `적금` |

### Response

전체 예적금 조회와 동일한 구조

### Status

| status | response content |
| --- | --- |
| 200 | 검색 결과 반환 |
| 400 | keyword 누락 |

</details>

---

<details>
<summary>GET /api/financial-products/insurance — 전체 미니보험 조회</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 보험 상품 목록 | List\<InsuranceProduct\> | | x | |
| [].productName | 상품명 | String | | x | `여행자 보험` |
| [].insurer | 보험사 | String | | x | `삼성화재` |
| [].category | 카테고리 | String | | x | `여행` |
| [].description | 상품 설명 | String | | o | `해외여행 시 의료비 보장` |
| [].ageMin | 가입 최소 나이 | Integer | | o | `18` |
| [].ageMax | 가입 최대 나이 | Integer | | o | `65` |

**Example**

```json
[
    {
        "productName": "여행자 보험",
        "insurer": "삼성화재",
        "category": "여행",
        "description": "해외여행 시 의료비 보장",
        "ageMin": 18,
        "ageMax": 65
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 보험 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/insurance/category/{category} — 카테고리별 보험 조회</summary>

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| category | 보험 카테고리 | String | | x | `여행` |

### Response

전체 미니보험 조회와 동일한 구조

### Status

| status | response content |
| --- | --- |
| 200 | 카테고리 내 보험 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/insurance/age/{age} — 나이별 보험 조회</summary>

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| age | 나이 | Integer | | x | `25` |

### Response

전체 미니보험 조회와 동일한 구조

### Status

| status | response content |
| --- | --- |
| 200 | 해당 나이 가입 가능 보험 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/insurance/search — 보험 키워드 검색</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| keyword | 검색 키워드 | String | | x | `여행` |

### Response

전체 미니보험 조회와 동일한 구조

### Status

| status | response content |
| --- | --- |
| 200 | 검색 결과 반환 |
| 400 | keyword 누락 |

</details>

---

<details>
<summary>POST /api/financial-products/cards/sync — 카드 데이터 DB 적재</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| status | 처리 상태 | String | | x | `success` |
| synced | 적재된 카드 수 | Integer | | x | `85` |

**Example**

```json
{
    "status": "success",
    "synced": 85
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 카드 데이터 적재 완료 |

</details>

---

<details>
<summary>GET /api/financial-products/cards — 전체 카드 조회</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 카드 목록 | List\<CardInfo\> | | x | |
| [].cardName | 카드명 | String | | x | `신한 트래블리 카드` |
| [].corpName | 카드사 | String | | x | `신한카드` |
| [].cardType | 카드 유형 | String | | x | `신용` |
| [].annualFeeBasic | 기본 연회비 | String | | o | `15,000원` |
| [].cardImgUrl | 카드 이미지 URL | String | | o | `https://...` |
| [].isDiscontinued | 단종 여부 | Boolean | | x | `false` |

**Example**

```json
[
    {
        "cardName": "신한 트래블리 카드",
        "corpName": "신한카드",
        "cardType": "신용",
        "annualFeeBasic": "15,000원",
        "cardImgUrl": "https://...",
        "isDiscontinued": false
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 전체 카드 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/cards/active — 현행 카드 조회 (단종 제외)</summary>

### Request

없음

### Response

전체 카드 조회와 동일한 구조, isDiscontinued = false 인 카드만 반환

### Status

| status | response content |
| --- | --- |
| 200 | 현행 카드 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/cards/corp/{corpName} — 카드사별 카드 조회</summary>

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| corpName | 카드사 이름 | String | | x | `신한카드` |

### Response

전체 카드 조회와 동일한 구조

### Status

| status | response content |
| --- | --- |
| 200 | 카드사별 카드 목록 반환 |

</details>

---

<details>
<summary>GET /api/financial-products/cards/search — 카드 키워드 검색</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| keyword | 검색 키워드 | String | | x | `트래블` |

### Response

전체 카드 조회와 동일한 구조

### Status

| status | response content |
| --- | --- |
| 200 | 검색 결과 반환 |
| 400 | keyword 누락 |

</details>

---

## FastAPI

---

### 🤖 Avatar

<details>
<summary>GET /api/avatar/{user_id} — 아바타 조회</summary>

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| avatar_title | 아바타 타이틀 | String | | x | `커피요정` |
| avatar_description | 아바타 설명 | String | | x | `카페를 사랑하는 소비자` |
| avatar_image | 아바타 이미지 S3 URL | String | | x | `https://s3.amazonaws.com/...` |
| generated_period | 이미지 생성에 사용된 날짜 범위 | String | | x | `2026-05-25 ~ 2026-05-31` |
| change_reason_summary | 아바타 변경 이유 요약 | String | | x | `카페 소비 비중이 높아졌어요` |

**Example**

```json
{
    "avatar_title": "커피요정",
    "avatar_description": "카페를 사랑하는 소비자",
    "avatar_image": "https://s3.amazonaws.com/sobee/avatars/1.png",
    "generated_period": "2026-05-25 ~ 2026-05-31",
    "change_reason_summary": "카페 소비 비중이 높아졌어요"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 아바타 정보 반환 |
| 404 | 아바타 없음 |

</details>

---

<details>
<summary>POST /api/avatar — 아바타 생성</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| start_date | 분석 시작 날짜 | String (yyyy-MM-dd) | optional | o | `2026-05-25` |
| end_date | 분석 종료 날짜 | String (yyyy-MM-dd) | optional | o | `2026-05-31` |

> start_date / end_date 미입력 시 지난주 월~일 자동 적용

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| avatar_title | 아바타 타이틀 | String | | x | `커피요정` |
| avatar_description | 아바타 설명 | String | | x | `카페를 사랑하는 소비자` |
| avatar_image | 아바타 이미지 S3 URL | String | | x | `https://s3.amazonaws.com/...` |
| generated_period | 이미지 생성에 사용된 날짜 범위 | String | | x | `2026-05-25 ~ 2026-05-31` |
| change_reason_summary | 아바타 변경 이유 요약 | String | | x | `카페 소비 비중이 높아졌어요` |

**Example**

```json
{
    "avatar_title": "커피요정",
    "avatar_description": "카페를 사랑하는 소비자",
    "avatar_image": "https://s3.amazonaws.com/sobee/avatars/1.png",
    "generated_period": "2026-05-25 ~ 2026-05-31",
    "change_reason_summary": "카페 소비 비중이 높아졌어요"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 아바타 생성 성공 |
| 400 | 필수 파라미터 누락 |

</details>

---

### 🔄 Lifecycle

<details>
<summary>POST /api/lifecycle — 라이프스테이지 예측</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| life_stage_code | 라이프스테이지 코드 | String | | x | `YOUNG_SINGLE` |
| description | 라이프스테이지 설명 | String | | x | `20대 싱글, 자기투자 중심 소비` |

**Example**

```json
{
    "life_stage_code": "YOUNG_SINGLE",
    "description": "20대 싱글, 자기투자 중심 소비"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 라이프스테이지 예측 성공 |
| 400 | user_id 누락 |

</details>

---

<details>
<summary>GET /api/lifecycle/{user_id} — 유저 라이프스테이지 조회</summary>

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| life_stage_code | 라이프스테이지 코드 | String | | x | `YOUNG_SINGLE` |
| description | 라이프스테이지 설명 | String | | x | `20대 싱글, 자기투자 중심 소비` |

**Example**

```json
{
    "life_stage_code": "YOUNG_SINGLE",
    "description": "20대 싱글, 자기투자 중심 소비"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 라이프스테이지 조회 성공 |
| 404 | 해당 유저 없음 |

</details>

---

### 📈 Report

<details>
<summary>GET /api/report/mydata/transaction — 거래내역 리포트 조회</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| year | 조회 연도 | Integer | optional | o | `2026` |
| month | 조회 월 | Integer | optional | o | `6` |

> year / month 미입력 시 전체 기간 조회

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| category_price | 카테고리별 소비 금액 | Object (Map) | | x | `{"카페간식": 32000, "식비": 54000}` |

**Example**

```json
{
    "category_price": {
        "카페간식": 32000,
        "식비": 54000,
        "교통": 12000
    }
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 거래내역 리포트 반환 |
| 400 | user_id 누락 |

</details>

---

<details>
<summary>GET /api/report/ai-insight — AI 소비 인사이트 + 상품 추천</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| year | 조회 연도 | Integer | optional | o | `2026` |
| month | 조회 월 | Integer | optional | o | `6` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| recommned | 추천 상품 목록 | List\<AiInsightItem\> | | x | |
| recommned[].product_name | 상품명 | String | | x | `신한 카페 카드` |
| recommned[].product_company | 금융사 | String | | x | `신한카드` |
| recommned[].product_img_url | 상품 이미지 URL | String | | o | `https://...` |
| recommned[].product_type | 상품 유형 | String | | x | `card` / `savings` |
| recommned[].reason | 추천 이유 | String | | o | `카페 소비가 많아 혜택이 커요` |
| recommned[].content | 상품 상세 정보 | AiInsightContent | | o | |
| message | AI 분석 메시지 | String | | o | `이번 달 카페 소비가 늘었어요` |

**Example**

```json
{
    "recommned": [
        {
            "product_name": "신한 카페 카드",
            "product_company": "신한카드",
            "product_img_url": "https://...",
            "product_type": "card",
            "reason": "카페 소비가 많아 혜택이 커요",
            "content": {
                "header": "카페 10% 할인",
                "middle": "월 최대 5,000원"
            }
        }
    ],
    "message": "이번 달 카페 소비가 늘었어요"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | AI 인사이트 및 상품 추천 반환 |
| 400 | user_id 누락 |

</details>

---

<details>
<summary>GET /api/report/recommend-questions — 소비 패턴 기반 추천 질문 생성</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| questions | 추천 질문 목록 | List\<String\> | | x | `["카페 혜택 좋은 카드는?", ...]` |

**Example**

```json
{
    "questions": [
        "카페 혜택 좋은 카드는?",
        "이번 달 소비 패턴에 맞는 카드 추천해줘"
    ]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 추천 질문 반환 |
| 400 | user_id 누락 |

</details>

---

### 💡 Recommend

<details>
<summary>POST /api/recommend — AI 금융상품 추천</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| query | 추천 요청 자연어 쿼리 | String | | x | `카페 할인 카드 추천해줘` |
| life_stage_code | 라이프스테이지 코드 | String | optional | o | `YOUNG_SINGLE` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 추천 상품 목록 | List\<RecommendResponse\> | | x | |
| [].product_id | 상품 ID | Integer | | x | `10` |
| [].product_name | 상품명 | String | | x | `신한 카페 카드` |
| [].reason | 추천 이유 | String | | x | `카페 소비 패턴에 최적화` |

**Example**

```json
[
    {
        "product_id": 10,
        "product_name": "신한 카페 카드",
        "reason": "카페 소비 패턴에 최적화"
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 추천 상품 목록 반환 |
| 400 | 필수 파라미터 누락 |

</details>

---

### 🏷️ Category Mapping

<details>
<summary>POST /api/category/resolve — 카테고리 단건 매핑</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| payment_category | 카드사 raw 카테고리 | String | | x | `음식점` |
| payment_place | 가맹점명 | String | optional | o | `스타벅스` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| payment_category_id | 표준 카테고리 ID (1~16) | Integer | | x | `2` |
| category_name | 표준 카테고리 이름 | String | | x | `카페간식` |
| matched_by | 매핑 방식 | String (enum) | | x | `tier2` / `tier1` / `etc` |

> matched_by: `tier2` = 유형+가맹점명 매칭 / `tier1` = 유형만 매칭 / `etc` = 매핑 실패 (16번 기타 반환)

**Example**

```json
{
    "payment_category_id": 2,
    "category_name": "카페간식",
    "matched_by": "tier2"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 카테고리 매핑 결과 반환 |
| 400 | 필수 파라미터 누락 |

</details>

---

<details>
<summary>POST /api/category/map-all — 미매핑 거래내역 일괄 처리</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| message | 처리 결과 메시지 | String | | x | `매핑 완료` |

**Example**

```json
{
    "message": "매핑 완료"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 일괄 매핑 완료 (룰베이스 → LLM 재분류 체이닝) |
| 400 | user_id 누락 |

</details>

---

<details>
<summary>POST /api/category/llm-reclassify — 기타 건 LLM 재분류</summary>

**Content-Type:** `application/json`

### Request

없음 (body 불필요)

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| message | 처리 결과 메시지 | String | | x | `LLM 재분류 완료` |

**Example**

```json
{
    "message": "LLM 재분류 완료"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | LLM 재분류 완료 |

</details>

---

### 📷 VLM

<details>
<summary>POST /api/vlm/analyze — 사진 분석 (Google Gemini)</summary>

**Content-Type:** `multipart/form-data`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| file | 분석할 이미지 파일 | UploadFile | | x | (binary) |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| category | 소비 카테고리 | String | | x | `카페간식` |
| item_name | 품목명 | String | | o | `아이스 아메리카노` |
| price | 추정 가격 (원) | Integer | | o | `4500` |
| location_type | 가게 유형 | String | | o | `카페` |
| store_name | 가게 이름 | String | | o | `스타벅스` |
| description | 사진 한 줄 설명 | String | | x | `카페에서 찍은 음료 사진` |
| confidence | 분석 신뢰도 | String | | x | `high` / `medium` / `low` |
| reasoning | 판단 근거 | String | | x | `카페 인테리어와 음료가 보임` |
| groups | 그룹별 소비 분석 배열 | List | | o | |

**Example**

```json
{
    "category": "카페간식",
    "item_name": "아이스 아메리카노",
    "price": 4500,
    "location_type": "카페",
    "store_name": "스타벅스",
    "description": "카페에서 찍은 음료 사진",
    "confidence": "high",
    "reasoning": "카페 인테리어와 음료가 보임",
    "groups": [
        {
            "group_id": 1,
            "store": "스타벅스",
            "category": "카페간식",
            "items": ["아이스 아메리카노"],
            "price": 4500
        }
    ]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | VLM 분석 결과 반환 |
| 500 | Gemini API 오류 |

</details>

---

### 🔗 Mapping

<details>
<summary>POST /api/mapping/match — 사진-결제내역 매핑 (LLM)</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| photo_id | 사진 ID | Integer | | x | `42` |
| user_id | 사용자 ID | Integer | | x | `1` |
| taken_at | 사진 촬영 일시 (KST) | String | optional | o | `2026-06-07 14:30:00` |
| location | 촬영 위치 (역지오코딩 주소) | String | optional | o | `서울시 강남구 ...` |
| groups | VLM이 추출한 그룹 목록 | List\<VlmGroup\> | | x | |
| groups[].group_id | 그룹 ID | Integer | | o | `1` |
| groups[].store | 가게명 | String | | o | `스타벅스` |
| groups[].category | 카테고리 | String | | o | `카페간식` |
| groups[].items | 품목 목록 | List\<String\> | | o | `["아이스 아메리카노"]` |
| groups[].price | 합산 금액 (원) | Float | | o | `4500` |
| candidates | 결제 내역 후보 목록 | List\<TransactionCandidate\> | | x | |
| candidates[].payment_id | 결제 내역 ID | Integer | | x | `201` |
| candidates[].payment_out | 결제 금액 (원) | Integer | | o | `4500` |
| candidates[].payment_time | 결제 일시 | String | | o | `2026-06-07 14:28:00` |
| candidates[].payment_place | 가맹점명 | String | | o | `스타벅스` |
| candidates[].payment_category | 카드사 카테고리 | String | | o | `음식점` |
| candidates[].payment_address | 가맹점 주소 | String | | o | `서울시 강남구 ...` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| [] | 매핑 결과 목록 | List\<MappingResponse\> | | x | |
| [].group_id | 그룹 ID | Integer | | o | `1` |
| [].payment_id | 매핑된 결제 내역 ID | Integer | | o | `201` |
| [].reason | 매핑 판단 이유 | String | | o | `금액과 시간이 일치` |

**Example**

```json
[
    {
        "group_id": 1,
        "payment_id": 201,
        "reason": "금액과 시간이 일치"
    }
]
```

### Status

| status | response content |
| --- | --- |
| 200 | 매핑 결과 반환 (매핑 불가 시 payment_id: null) |
| 400 | 필수 파라미터 누락 |

</details>

---

### 📝 Diary Generate

<details>
<summary>POST /api/diary/generate — AI 소비 일기 생성 (GPT-4o-mini)</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| item_name | 품목명 | String | optional | o | `아이스 아메리카노` |
| category | 소비 카테고리 | String | optional | o | `카페간식` |
| price | 결제 금액 (원) | Integer | optional | o | `4500` |
| store_name | 가게 이름 | String | optional | o | `스타벅스` |
| description | VLM 사진 설명 | String | optional | o | `카페에서 찍은 음료 사진` |
| mood | 소비 기분 이모지 | String | optional | o | `😍` |
| emotion_text | 사용자 메모 | String | optional | o | `진짜 맛있었다` |
| matched | 결제 내역 매핑 여부 | Boolean | optional | o | `true` |
| tags | 해시태그 목록 | List\<String\> | optional | o | `["#스벅", "#카페"]` |
| group_description | 모임방 설명 | String | optional | o | `카페 거지방` |
| photo_count | 사진 수 (문장 수 결정) | Integer | optional | o | `2` |
| room_category | 모임방 테마 카테고리 | String | optional | o | `FOOD` |

> matched = false 또는 null 이면 결제 정보 없이 사진·감정 위주로 일기 생성

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| title | 일기 제목 (이모지 포함, 12자 이내) | String | | x | `오늘도 스벅 🤣` |
| diary_lines | 일기 본문 문장 목록 | List\<String\> | | x | |
| tags | 해시태그 목록 | List\<String\> | | x | `["#스벅"]` |

**Example**

```json
{
    "title": "오늘도 스벅 🤣",
    "diary_lines": [
        "아니 오늘 아아 없었으면 진짜 기절각이었음 ㅠㅠ",
        "스벅 들어가는 순간 지갑이 먼저 열렸다 ㅋㅋ",
        "합리화 완료 😍"
    ],
    "tags": ["#스벅", "#카페"]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | AI 일기 생성 성공 |
| 500 | OpenAI API 오류 또는 파싱 실패 |

</details>

---

## FastAPI Internal

> Spring Boot → FastAPI 서비스 간 내부 통신 전용
> `X-Internal-Secret` 헤더 필수

---

<details>
<summary>GET /internal/sync/status — 거래내역 적재 완료 여부 확인</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| synced | 거래내역 존재 여부 | Boolean | | x | `true` |
| transaction_count | 전체 거래내역 수 | Integer | | x | `87` |

**Example**

```json
{
    "synced": true,
    "transaction_count": 87
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 적재 상태 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>GET /internal/accounts/available-orgs — ENV 등록 기관 코드 목록 반환</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| bank_codes | 은행 코드 목록 | List\<String\> | | x | `["0020"]` |
| card_codes | 카드사 코드 목록 | List\<String\> | | x | `["0301"]` |

**Example**

```json
{
    "bank_codes": ["0020"],
    "card_codes": ["0301"]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 기관 코드 목록 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/accounts/register-from-env — ENV 기반 기관 등록 + sync 트리거</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| bank_codes | 등록할 은행 코드 목록 | List\<String\> | | x | `["0020"]` |
| card_codes | 등록할 카드사 코드 목록 | List\<String\> | | x | `["0301"]` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| registered | 등록 성공 코드 목록 | List\<String\> | | x | `["0020", "0301"]` |
| missing | ENV에 없는 코드 목록 | List\<String\> | | x | `[]` |
| message | 처리 결과 메시지 | String | | x | `2개 기관 등록 완료. 30일 sync 시작.` |

**Example**

```json
{
    "user_id": 1,
    "registered": ["0020", "0301"],
    "missing": [],
    "message": "2개 기관 등록 완료. 30일 sync 시작."
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 기관 등록 완료 및 Airflow sync 트리거 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>GET /internal/users — 전체 유저 ID 목록 조회 (Airflow용)</summary>

### Request

없음

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_ids | 전체 유저 ID 목록 | List\<Integer\> | | x | `[1, 2, 3]` |

**Example**

```json
{
    "user_ids": [1, 2, 3]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 유저 ID 목록 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/accounts/setup — ENV 전체 계정 일괄 등록</summary>

### Request

없음 (ENV의 CODEF_ACCOUNT_N 설정값 자동 사용)

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| results | 계정별 등록 결과 목록 | List\<Object\> | | x | |
| results[].user_id | 사용자 ID | Integer | | x | `1` |
| results[].org_code | 기관 코드 | String | | x | `0020` |
| results[].status | 등록 상태 | String | | x | `ok` / `error` |

**Example**

```json
{
    "results": [
        {"user_id": 1, "org_code": "0020", "status": "ok"},
        {"user_id": 1, "org_code": "0301", "status": "ok"}
    ]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 일괄 등록 결과 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>GET /internal/accounts/{user_id} — 유저 connected_id 목록 조회</summary>

### Request

**Path parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| connected_ids | connected_id 목록 | List\<ConnectedIdInfo\> | | x | |
| connected_ids[].connected_id | CODEF connected_id | String | | x | `cid_abc` |
| connected_ids[].institutions | 등록 기관 목록 | List\<Object\> | | x | |

**Example**

```json
{
    "user_id": 1,
    "connected_ids": [
        {
            "connected_id": "cid_abc",
            "institutions": [
                {"businessType": "BK", "organization": "0020"},
                {"businessType": "CD", "organization": "0301"}
            ]
        }
    ]
}
```

### Status

| status | response content |
| --- | --- |
| 200 | connected_id 목록 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/accounts/register — 금융기관 계정 등록 (CODEF)</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| business_type | 기관 유형 | String | | x | `BK` (은행) / `CD` (카드) |
| org_code | 기관 코드 | String | | x | `0020` |
| login_id | 로그인 ID | String | | x | `user123` |
| login_pw | 로그인 비밀번호 | String | | x | `pass123` |
| connected_id | 기존 connected_id (기관 추가 시) | String | optional | o | `cid_abc` |

> connected_id 미전달 시 새 connected_id 발급, 전달 시 기존 connected_id에 기관 추가

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| business_type | 기관 유형 | String | | x | `BK` |
| org_code | 기관 코드 | String | | x | `0020` |
| connected_id | 발급/사용된 connected_id | String | | x | `cid_abc` |
| message | 처리 결과 메시지 | String | | x | `connected_id 발급 완료. Airflow 초기 30일 sync 트리거됨.` |

**Example**

```json
{
    "user_id": 1,
    "business_type": "BK",
    "org_code": "0020",
    "connected_id": "cid_abc",
    "message": "connected_id 발급 완료. Airflow 초기 30일 sync 트리거됨."
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 기관 등록 완료 및 30일 sync 트리거 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/transactions/sync — 거래내역 sync 실행</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| days | 조회 일수 | Integer | optional | o | `30` |
| mode | 계정 조회 방식 | String | | x | `env` / `secrets` |

> days 미입력 시 일별 default 적용 / mode: `env` = ENV JSON 배열 사용, `secrets` = AWS Secrets Manager 사용

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| message | 처리 결과 메시지 | String | | x | `sync 완료 [env] \| 기간:... 계좌:2 카드:1 transactions:87` |

**Example**

```json
{
    "message": "sync 완료 [env] | 기간:2026-05-08~2026-06-07 계좌:2 카드:1 transactions:87"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | sync 완료 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/mapping/run — 매핑 파이프라인 실행</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| start_date | 매핑 시작 날짜 | String (yyyy-MM-dd) | optional | o | `2026-05-25` |
| end_date | 매핑 종료 날짜 | String (yyyy-MM-dd) | optional | o | `2026-05-31` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| message | 처리 결과 메시지 | String | | x | `mapping complete` |

**Example**

```json
{
    "message": "mapping complete"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 매핑 파이프라인 완료 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/diary/generate — 일기 생성 파이프라인 실행 (Airflow용)</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| message | 처리 결과 메시지 | String | | x | `diary generated` |

**Example**

```json
{
    "message": "diary generated"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 일기 생성 파이프라인 완료 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>POST /internal/parse-search — 검색 쿼리 파싱</summary>

**Content-Type:** `application/json`

### Request

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| query | 자연어 검색 쿼리 | String | | x | `신한 여행 카드` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| product_types | 감지된 상품 유형 목록 | List\<String\> | | x | `["card"]` |
| company | 감지된 금융사 | String | | o | `신한카드` |
| category | 감지된 카테고리 | String | | o | `여행숙박` |
| keywords | 핵심 키워드 목록 | List\<String\> | | x | `["여행", "트래블"]` |
| ai_text | AI 분석 텍스트 | String | | x | `여행 혜택이 좋은 신한 카드를 찾고 있어요` |

**Example**

```json
{
    "product_types": ["card"],
    "company": "신한카드",
    "category": "여행숙박",
    "keywords": ["여행", "트래블"],
    "ai_text": "여행 혜택이 좋은 신한 카드를 찾고 있어요"
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 검색 쿼리 파싱 결과 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>

---

<details>
<summary>GET /internal/persona/has-photo — 지난주 photo-결제 매핑 데이터 존재 여부 확인 (Airflow용)</summary>

### Request

**Query parameter**

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| user_id | 사용자 ID | Integer | | x | `1` |
| start_date | 조회 시작 날짜 | String (yyyy-MM-dd) | | x | `2026-05-25` |
| end_date | 조회 종료 날짜 | String (yyyy-MM-dd) | | x | `2026-05-31` |

### Response

| key | 설명 | value 타입 | 옵션 | Nullable | 예시 |
| --- | --- | --- | --- | --- | --- |
| has_photo | 매핑 데이터 존재 여부 | Boolean | | x | `true` |
| count | 매핑된 데이터 수 | Integer | | x | `5` |

**Example**

```json
{
    "has_photo": true,
    "count": 5
}
```

### Status

| status | response content |
| --- | --- |
| 200 | 존재 여부 반환 |
| 403 | X-Internal-Secret 불일치 |

</details>
