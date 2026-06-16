#!/bin/bash
set -e

ML_DIR="/app/ml"
mkdir -p "$ML_DIR"

echo "S3?์ ml/ ?์ผ ?ค์ด๋ก๋“ ์ค?.."

aws s3 cp "s3://${S3_BUCKET_NAME}/ml/lifecycle_model.py" "$ML_DIR/lifecycle_model.py" && \
    echo "lifecycle_model.py ?ค์ด๋ก๋“ ?๋ฃ" || echo "lifecycle_model.py ?ค์ด๋ก๋“ ?คํจ"

aws s3 cp "s3://${S3_BUCKET_NAME}/ml/model.pkl" "$ML_DIR/model.pkl" && \
    echo "model.pkl ?ค์ด๋ก๋“ ?๋ฃ" || echo "model.pkl ?ค์ด๋ก๋“ ?คํจ"

if [ "$ENV" = "dev" ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
fi
