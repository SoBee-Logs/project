#!/bin/bash
set -e

ML_DIR="/app/ml"
mkdir -p "$ML_DIR"

echo "S3에서 ml/ 파일 다운로드 중..."

aws s3 cp "s3://${S3_BUCKET_NAME}/ml/lifecycle_model.py" "$ML_DIR/lifecycle_model.py" && \
    echo "lifecycle_model.py 다운로드 완료" || echo "lifecycle_model.py 다운로드 실패"

aws s3 cp "s3://${S3_BUCKET_NAME}/ml/model.pkl" "$ML_DIR/model.pkl" && \
    echo "model.pkl 다운로드 완료" || echo "model.pkl 다운로드 실패"

if [ "$ENV" = "dev" ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
fi
