# Connected ID 등록 가이드

Airflow가 매일 자동으로 결제 데이터를 가져오려면 **본인의 은행/카드 계정을 CODEF에 1회 등록**해야 합니다.  
등록하면 `connected_id`가 발급되어 AWS Secrets Manager에 저장되고, 이후 Airflow가 이를 사용해 자동으로 데이터를 동기화합니다.  
loginId/loginPw는 CODEF에 전달 후 즉시 폐기되며, 서버 어디에도 저장되지 않습니다.

---

## Swagger 주소

```
http://43.202.64.162:8000/docs
```

---

## 계정 등록

### 방법 A: register-from-env (ENV에 본인 계정이 있는 경우)

`POST /internal/accounts/register-from-env` 호출

```json
{
  "user_id": <본인 user_id>,
  "bank_codes": ["0020"],
  "card_codes": ["0306", "0313"]
}
```

등록할 기관 코드만 배열에 포함하면 됩니다. 이미 등록된 기관은 자동 skip됩니다.

---

### 방법 B: register (loginId/loginPw 직접 입력)

#### Step 1. 첫 번째 기관 등록 → connected_id 신규 발급

`POST /internal/accounts/register` 호출

```json
{
  "user_id": <본인 user_id>,
  "business_type": "BK",
  "org_code": "<은행 코드>",
  "login_id": "<인터넷뱅킹 아이디>",
  "login_pw": "<인터넷뱅킹 비밀번호>"
}
```

응답의 `connected_id` 값을 복사해 둡니다.

#### Step 2. 추가 기관 등록

**loginId가 같은 경우** (예: 신한은행과 신한카드 아이디 동일)  
→ Step 1의 `connected_id`를 전달해 하나로 묶기

```json
{
  "user_id": <본인 user_id>,
  "business_type": "CD",
  "org_code": "<카드 코드>",
  "login_id": "<동일한 아이디>",
  "login_pw": "<비밀번호>",
  "connected_id": "<Step 1에서 발급된 connected_id>"
}
```

**loginId가 다른 경우** (예: 신한은행과 하나카드 아이디가 다름)  
→ `connected_id` 없이 호출하면 새 connected_id 자동 발급

```json
{
  "user_id": <본인 user_id>,
  "business_type": "CD",
  "org_code": "<카드 코드>",
  "login_id": "<다른 아이디>",
  "login_pw": "<다른 비밀번호>"
}
```

등록할 기관 수만큼 반복합니다. loginId가 다른 기관마다 새 connected_id가 발급됩니다.

> 같은 은행에 계좌가 여러 개 있어도 기관 코드 1개만 등록하면 전체 계좌를 자동으로 가져옵니다.

---

## 트랜잭션 동기화

등록 완료 후 최근 30일 트랜잭션 sync가 **자동으로 백그라운드 실행**됩니다.  
수동으로 실행하거나 재sync가 필요한 경우 아래 엔드포인트를 호출하세요.

`POST /internal/transactions/sync`

```json
{
  "user_id": <본인 user_id>,
  "days": 30
}
```

> `days` 생략 시 기본 3일만 가져옵니다. 최초 등록 후에는 `30`으로 명시하세요.

---

## 등록 확인

`GET /internal/accounts/{user_id}` 로 등록된 connected_id 목록 조회

```json
{
  "user_id": 114,
  "connected_ids": [
    {
      "connected_id": "cid_abc123",
      "institutions": [
        {"businessType": "BK", "organization": "0088"},
        {"businessType": "CD", "organization": "0306"}
      ]
    }
  ]
}
```

---

## 기관 코드표

### 은행 (`business_type: "BK"`)

| 은행명 | org_code |
|--------|----------|
| 산업은행 | `0002` |
| 기업은행 | `0003` |
| 국민은행 | `0004` |
| 수협은행 | `0007` |
| 농협은행 | `0011` |
| 우리은행 | `0020` |
| SC은행 | `0023` |
| 씨티은행 | `0027` |
| 대구은행 | `0031` |
| 부산은행 | `0032` |
| 광주은행 | `0034` |
| 제주은행 | `0035` |
| 전북은행 | `0037` |
| 경남은행 | `0039` |
| 새마을금고 | `0045` |
| 신협은행 | `0048` |
| 우체국 | `0071` |
| KEB하나은행 | `0081` |
| 신한은행 | `0088` |
| K뱅크 | `0089` |

### 카드 (`business_type: "CD"`)

| 카드사 | org_code |
|--------|----------|
| KB카드 | `0301` |
| 현대카드 | `0302` |
| 삼성카드 | `0303` |
| NH카드 | `0304` |
| BC카드 | `0305` |
| 신한카드 | `0306` |
| 씨티카드 | `0307` |
| 우리카드 | `0309` |
| 롯데카드 | `0311` |
| 하나카드 | `0313` |

---

## 주의사항

- CODEF sandbox는 **담당자 계정당 하루 100건** API 호출 제한이 있습니다.
- 등록은 1회만 하면 됩니다. 이미 등록된 기관은 재호출해도 자동 skip됩니다.
- **현재 Airflow DAG는 팀원 전원 등록 완료 전까지 일시 중지 상태입니다.** 전원 등록이 확인되면 활성화되며, 이후 매일 새벽 2시에 자동으로 데이터를 가져옵니다.
