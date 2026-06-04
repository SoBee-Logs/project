"""
sobee_transaction_sync
────────────────────────────────────────
[스케줄] 매일 새벽 2시 — 전체 유저 sync (days=3)
         월요일만: sync 완료 후 페르소나(아바타) 생성까지 실행

[트리거 A] 회원가입 직후 특정 유저 초기 sync
  conf: {"user_id": 1, "days": 30}
  → 해당 유저 sync만 실행, persona 생략

[트리거 B] 전체 유저 수동 실행 (persona 강제 포함)
  conf: {"force_persona": true}
  → 전체 유저 sync + persona 실행

트리거 방법:
  Airflow UI → Trigger DAG w/ config
  또는 REST API:
    POST /api/v1/dags/sobee_transaction_sync/dagRuns
    Body: {"conf": {"user_id": 1, "days": 30}}
"""
import os
from datetime import datetime

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


def task_sync(**ctx):
    """
    conf에 user_id 있음 → 해당 유저만 sync (회원가입 트리거 A)
    conf 없음 or force_persona → 전체 유저 sync (스케줄 / 트리거 B)
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
        results = []
        for uid in user_ids:
            try:
                res = requests.post(
                    f"{FASTAPI_URL}/internal/transactions/sync",
                    headers=HEADERS,
                    json={"user_id": uid, "days": days},
                    timeout=TIMEOUT,
                )
                res.raise_for_status()
                results.append({"user_id": uid, "status": "ok"})
            except Exception as e:
                results.append({"user_id": uid, "status": "error", "error": str(e)})
                print(f"sync 실패 user={uid}: {e}")
        ctx["ti"].xcom_push(key="sync_results", value=results)
        print(f"전체 sync 완료: {len(results)}명")


def should_run_persona(**ctx) -> bool:
    """
    persona 실행 조건:
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
    """전체 유저 페르소나(아바타) 생성 → S3 업로드 → users 업데이트"""
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
    dag_id="sobee_transaction_sync",
    description="매일 sync + 월요일 persona | 트리거: 특정 유저 sync / 전체 persona 강제 실행",
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
