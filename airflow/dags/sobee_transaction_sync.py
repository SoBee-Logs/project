"""
sobee_transaction_sync
────────────────────────────────────────
[스케줄] 매일 새벽 2시
  1. 전체 유저 transactions sync (3일치 fetch → merge → 카테고리 → 생애주기)
  2. 월요일만: 지난주(월~일) photo 데이터 있는 유저에 한해 아바타 생성

[트리거 A] 회원가입 직후 특정 유저 초기 sync
  conf: {"user_id": 1, "days": 30}
  → 해당 유저 sync만 실행, 아바타 생성 없음

[트리거 B] 전체 유저 수동 아바타 강제 생성
  conf: {"force_persona": true}
  → 전체 유저 sync + 아바타 생성 (photo 데이터 없는 유저도 포함)

트리거 방법:
  Airflow UI → Trigger DAG w/ config
  또는 REST API:
    POST /api/v1/dags/sobee_transaction_sync/dagRuns
    Body: {"conf": {"user_id": 1, "days": 30}}
"""
import os
from datetime import datetime, timedelta

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator, ShortCircuitOperator

FASTAPI_URL = os.environ.get("SOBEE_FASTAPI_URL", "http://host.docker.internal:8000")
SECRET = os.environ.get("SOBEE_INTERNAL_SECRET", "")
HEADERS = {"X-Internal-Secret": SECRET, "Content-Type": "application/json"}
TIMEOUT = 300

DAILY_SYNC_DAYS = 3
INITIAL_SYNC_DAYS = 30


def _get_all_user_ids() -> list[int]:
    res = requests.get(f"{FASTAPI_URL}/internal/users", headers=HEADERS, timeout=30)
    res.raise_for_status()
    return res.json()["user_ids"]


def _last_week_range() -> tuple[str, str]:
    """지난주 월요일~일요일 반환 (YYYY-MM-DD)"""
    today = datetime.utcnow().date()
    this_monday = today - timedelta(days=today.weekday())
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)
    return str(last_monday), str(last_sunday)


def task_sync(**ctx):
    """
    conf에 user_id 있음 → 해당 유저만 sync (회원가입 트리거 A)
    conf 없음            → 전체 유저 sync (스케줄 / 트리거 B)
    """
    conf = ctx["dag_run"].conf or {}
    user_id = conf.get("user_id")
    days = int(conf.get("days", DAILY_SYNC_DAYS))

    if user_id:
        res = requests.post(
            f"{FASTAPI_URL}/internal/transactions/sync",
            headers=HEADERS,
            json={"user_id": int(user_id), "days": days},
            timeout=TIMEOUT,
        )
        res.raise_for_status()
        print(f"sync 완료: user_id={user_id} days={days}")
    else:
        user_ids = _get_all_user_ids()
        for uid in user_ids:
            try:
                res = requests.post(
                    f"{FASTAPI_URL}/internal/transactions/sync",
                    headers=HEADERS,
                    json={"user_id": uid, "days": days},
                    timeout=TIMEOUT,
                )
                res.raise_for_status()
            except Exception as e:
                print(f"sync 실패 user={uid}: {e}")
        print(f"전체 sync 완료: {len(user_ids)}명")


def should_run_persona(**ctx) -> bool:
    """
    아바타 생성 실행 조건:
    - 특정 유저 트리거(user_id 있음)면 skip
    - 월요일 스케줄 또는 force_persona=true 트리거면 실행
    """
    conf = ctx["dag_run"].conf or {}
    if conf.get("user_id"):
        return False
    if conf.get("force_persona"):
        return True
    return ctx["logical_date"].weekday() == 0  # 월요일


def task_persona(**ctx):
    """
    유저별로 지난주(월~일) persona_transaction 데이터 존재 여부 확인.
    - photo 데이터 있음 → /api/avatar 호출 (사진+transactions 기반 아바타)
    - photo 데이터 없음 → skip (transactions만으론 이번 주기 아바타 미생성)
    force_persona=true 트리거 시에는 photo 데이터 없어도 생성.
    """
    conf = ctx["dag_run"].conf or {}
    force = conf.get("force_persona", False)
    start_date, end_date = _last_week_range()

    user_ids = _get_all_user_ids()
    for uid in user_ids:
        # 지난주 photo 데이터 존재 여부 확인
        if not force:
            try:
                res = requests.get(
                    f"{FASTAPI_URL}/internal/persona/has-photo",
                    headers=HEADERS,
                    params={"user_id": uid, "start_date": start_date, "end_date": end_date},
                    timeout=30,
                )
                res.raise_for_status()
                if not res.json().get("has_photo", False):
                    print(f"photo 데이터 없음 — 아바타 skip: user_id={uid}")
                    continue
            except Exception as e:
                print(f"photo 체크 실패 user={uid}: {e} — skip")
                continue

        try:
            res = requests.post(
                f"{FASTAPI_URL}/api/avatar",
                headers=HEADERS,
                json={"user_id": uid, "start_date": start_date, "end_date": end_date},
                timeout=TIMEOUT,
            )
            res.raise_for_status()
            print(f"아바타 생성 완료: user_id={uid}")
        except Exception as e:
            print(f"아바타 생성 실패 user={uid}: {e}")

    print(f"persona 완료: {len(user_ids)}명 처리")


with DAG(
    dag_id="sobee_transaction_sync",
    description="매일 sync, 월요일 photo 있는 유저 아바타 생성",
    schedule="0 2 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["sobee", "transaction", "persona"],
) as dag:

    sync = PythonOperator(
        task_id="sync_transactions",
        python_callable=task_sync,
    )

    check_persona = ShortCircuitOperator(
        task_id="check_persona",
        python_callable=should_run_persona,
    )

    persona = PythonOperator(
        task_id="persona_all",
        python_callable=task_persona,
    )

    sync >> check_persona >> persona
