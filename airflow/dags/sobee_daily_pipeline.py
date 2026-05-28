"""
sobee_daily_pipeline
────────────────────────────────────────
매일 새벽 2시 실행. 전체 유저 대상.

스케줄 (월~금):
  매일: Step1. transactions 업데이트 (최근 3일치)
        Step2. 사진 ↔ 결제 매핑 → persona_transaction 최신화
  월요일만: Step3. 전주 Mon~Sun 기준 페르소나 생성 → S3 업로드 → users 업데이트

* 최초 가입 시 초기 sync(30일)는 /internal/accounts/register 호출 시 자동 트리거됨.
* 일별 sync는 days=3 (주말 포함 안전 마진). 해당 기간만 DELETE → INSERT로 멱등 보장.
"""
import os
from datetime import datetime

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator, ShortCircuitOperator

FASTAPI_URL = os.environ.get("SOBEE_FASTAPI_URL", "http://host.docker.internal:8000")
SECRET = os.environ.get("SOBEE_INTERNAL_SECRET", "")
HEADERS = {"X-Internal-Secret": SECRET, "Content-Type": "application/json"}
TIMEOUT = 300  # 5분
DAILY_SYNC_DAYS = 3  # 일별 동기화 기간 (sync_service.DAILY_SYNC_DAYS와 동일)


def _get_all_user_ids() -> list[int]:
    res = requests.get(f"{FASTAPI_URL}/internal/users", headers=HEADERS, timeout=30)
    res.raise_for_status()
    return res.json()["user_ids"]


def task_sync_all(**ctx):
    """Step 1: 전체 유저 transactions 업데이트 (최근 3일, 멱등)"""
    user_ids = _get_all_user_ids()
    results = []
    for uid in user_ids:
        try:
            res = requests.post(
                f"{FASTAPI_URL}/internal/transactions/sync",
                headers=HEADERS,
                json={"user_id": uid, "days": DAILY_SYNC_DAYS},
                timeout=TIMEOUT,
            )
            res.raise_for_status()
            results.append({"user_id": uid, "status": "ok", **res.json()})
        except Exception as e:
            results.append({"user_id": uid, "status": "error", "error": str(e)})
    ctx["ti"].xcom_push(key="sync_results", value=results)
    print(f"sync 완료: {len(results)}명")


def is_monday(**ctx) -> bool:
    """월요일에만 mapping → persona 실행"""
    return ctx["logical_date"].weekday() == 0


def task_mapping_all(**ctx):
    """Step 2: 사진 ↔ 결제 매핑 → persona_transaction 최신화 (월요일만)"""
    user_ids = _get_all_user_ids()
    for uid in user_ids:
        try:
            res = requests.post(
                f"{FASTAPI_URL}/internal/mapping/run",
                headers=HEADERS,
                json={"user_id": uid},
                timeout=TIMEOUT,
            )
            res.raise_for_status()
        except Exception as e:
            print(f"mapping 실패 user={uid}: {e}")
    print(f"mapping 완료: {len(user_ids)}명")


def task_persona_all(**ctx):
    """Step 3: 전주 Mon~Sun 기준 페르소나 생성 → S3 업로드 → users 업데이트 (월요일만)"""
    user_ids = _get_all_user_ids()
    for uid in user_ids:
        try:
            res = requests.post(
                f"{FASTAPI_URL}/internal/persona/generate",
                headers=HEADERS,
                json={"user_id": uid},
                timeout=TIMEOUT,
            )
            res.raise_for_status()
        except Exception as e:
            print(f"persona 실패 user={uid}: {e}")
    print(f"persona 생성 완료: {len(user_ids)}명")


with DAG(
    dag_id="sobee_daily_pipeline",
    description="매일 새벽 2시 — sync → mapping(매일) → persona(월요일만)",
    schedule="0 2 * * 1-5",  # 월~금
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["sobee", "daily"],
) as dag:

    sync = PythonOperator(
        task_id="sync_all",
        python_callable=task_sync_all,
    )

    check_monday = ShortCircuitOperator(
        task_id="check_monday",
        python_callable=is_monday,
    )

    mapping = PythonOperator(
        task_id="mapping_all",
        python_callable=task_mapping_all,
    )

    persona = PythonOperator(
        task_id="persona_all",
        python_callable=task_persona_all,
    )

    sync >> mapping >> check_monday >> persona
