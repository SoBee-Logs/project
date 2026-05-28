"""
sobee_manual_diary_pipeline
────────────────────────────────────────
수동 트리거 전용. 특정 유저의 일기 생성.

트리거 방법:
  Airflow UI → Trigger DAG w/ config
  또는 CLI:
    airflow dags trigger sobee_manual_diary_pipeline \
      --conf '{"user_id": 1}'
"""
import os
from datetime import datetime

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator

FASTAPI_URL = os.environ.get("SOBEE_FASTAPI_URL", "http://host.docker.internal:8000")
SECRET = os.environ.get("SOBEE_INTERNAL_SECRET", "")
HEADERS = {"X-Internal-Secret": SECRET, "Content-Type": "application/json"}
TIMEOUT = 300


def task_generate_diary(**ctx):
    conf = ctx["dag_run"].conf or {}
    user_id = conf.get("user_id")
    if not user_id:
        raise ValueError("dag_run.conf에 user_id가 필요합니다. 예: {\"user_id\": 1}")

    res = requests.post(
        f"{FASTAPI_URL}/internal/diary/generate",
        headers=HEADERS,
        json={"user_id": int(user_id)},
        timeout=TIMEOUT,
    )
    res.raise_for_status()
    print(f"일기 생성 완료: user_id={user_id} | {res.json()}")


with DAG(
    dag_id="sobee_manual_diary_pipeline",
    description="수동 트리거 — 특정 유저 일기 생성 (dag_run.conf: {user_id: N})",
    schedule=None,  # 수동 트리거만
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["sobee", "manual", "diary"],
) as dag:

    generate_diary = PythonOperator(
        task_id="generate_diary",
        python_callable=task_generate_diary,
    )
