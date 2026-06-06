"""
단위 테스트: lifecycle_service.py + lifecycle_model.py
- 실제 DB, ML 모델(.pkl) 없이 Mock으로 대체
- 총 13개 테스트
"""
import pytest
import numpy as np
from unittest.mock import MagicMock, AsyncMock, patch, PropertyMock


# ══════════════════════════════════════════════════════════════
# 그룹 1: transactions_to_features — 순수 함수 (4개)
# Mock 없이 바로 테스트 가능
# ══════════════════════════════════════════════════════════════
class TestTransactionsToFeatures:
    """
    transactions_to_features(user_transactions)
    - 트랜잭션 리스트 → 피처 딕셔너리 변환
    - 외부 의존성 없는 순수 함수
    """

    def setup_method(self):
        from ml.lifecycle_model import LifecycleModel
        self.model = LifecycleModel()

    def test_빈_트랜잭션_입력시_모든_피처_0(self):
        # Given: 트랜잭션 없음
        result = self.model.transactions_to_features([])

        # Then: 모든 피처가 0.0
        assert all(v == 0.0 for v in result.values())

    def test_식비_트랜잭션_입력시_식비_피처에_값_채워짐(self):
        # Given: 식비(category_id=1) 트랜잭션 1건
        tx = [{"payment_category_id": 1, "payment_out": 10000}]

        result = self.model.transactions_to_features(tx)

        # Then: 식비 관련 피처(FSBZ_AM_AMT_RATIO)에 값이 있음
        assert result["FSBZ_AM_AMT_RATIO"] > 0.0

    def test_매핑_없는_카테고리는_피처_변화_없음(self):
        # Given: 금융(13), 경조(14), 기타(16) — CAT_ID_MAP에서 매핑 컬럼 없음
        tx = [
            {"payment_category_id": 13, "payment_out": 5000},
            {"payment_category_id": 14, "payment_out": 5000},
            {"payment_category_id": 16, "payment_out": 5000},
        ]

        result = self.model.transactions_to_features(tx)

        # Then: 매핑 컬럼 없으므로 모든 비율 피처가 0
        assert result["FSBZ_AM_AMT_RATIO"] == 0.0
        assert result["DIST_AM_AMT_RATIO"] == 0.0

    def test_여러_카테고리_입력시_각_피처에_값_채워짐(self):
        # Given: 식비(1) + 교통(5) 트랜잭션
        tx = [
            {"payment_category_id": 1, "payment_out": 20000},
            {"payment_category_id": 5, "payment_out": 10000},
        ]

        result = self.model.transactions_to_features(tx)

        # Then: 식비, 교통 관련 피처 모두 값 있음
        assert result["FSBZ_AM_AMT_RATIO"] > 0.0
        assert result["AUTO_AM_AMT_RATIO"] > 0.0


# ══════════════════════════════════════════════════════════════
# 그룹 2: _apply_age_mask — 나이 마스킹 (3개)
# ══════════════════════════════════════════════════════════════
class TestApplyAgeMask:
    """
    _apply_age_mask(proba, age)
    - 나이에 따라 불가능한 생애주기 확률을 0으로 마스킹
    - le.classes_만 Mock으로 주입
    """

    def setup_method(self):
        from ml.lifecycle_model import LifecycleModel
        self.model = LifecycleModel()
        # 실제 classes_ 배열과 동일하게 구성
        self.model.le = MagicMock()
        self.model.le.classes_ = np.array([
            'CHILD_BABY', 'CHILD_TEEN', 'CHILD_UNI',
            'GOLLIFE', 'NEW_JOB', 'NEW_WED',
            'RETIR', 'SECLIFE', 'TEEN', 'UNI',
        ])

    def test_나이0이면_마스킹_없이_원본_확률_반환(self):
        # Given: 나이 정보 없음 (0)
        proba = np.ones(10) / 10  # 균등 확률

        result = self.model._apply_age_mask(proba, age=0)

        # Then: 마스킹 없이 그대로 반환
        np.testing.assert_array_almost_equal(result, proba)

    def test_나이18이면_신혼_자녀영유아_등_마스킹(self):
        # Given: 18세 → NEW_WED, CHILD_BABY, CHILD_TEEN, CHILD_UNI 등 불가
        proba = np.ones(10) / 10
        classes = list(self.model.le.classes_)

        result = self.model._apply_age_mask(proba, age=18)

        # Then: NEW_WED, CHILD_BABY 확률이 0
        assert result[classes.index('NEW_WED')]    == 0.0
        assert result[classes.index('CHILD_BABY')] == 0.0

    def test_나이60이면_십대_대학생_마스킹(self):
        # Given: 60세 → TEEN, UNI, NEW_JOB, NEW_WED, CHILD_BABY 불가
        proba = np.ones(10) / 10
        classes = list(self.model.le.classes_)

        result = self.model._apply_age_mask(proba, age=60)

        # Then: TEEN, UNI 확률이 0
        assert result[classes.index('TEEN')] == 0.0
        assert result[classes.index('UNI')]  == 0.0


# ══════════════════════════════════════════════════════════════
# 그룹 3: predict_lifecycle — 서비스 fallback (3개)
# ══════════════════════════════════════════════════════════════
class TestPredictLifecycle:
    """
    predict_lifecycle(request)
    - ML 모델 없을 때 / 트랜잭션 없을 때 fallback
    - engine, ML 모델을 Mock으로 교체
    """

    @pytest.mark.asyncio
    async def test_ML_없을때_fallback_반환(self):
        # Given: ML 모델 로드 실패 상태
        with patch("app.services.lifecycle_service.ML_AVAILABLE", False):
            from app.services.lifecycle_service import predict_lifecycle
            from app.models.schemas import LifecycleRequest

            result = await predict_lifecycle(LifecycleRequest(user_id=1))

        # Then: 모델 없음 안내 반환
        assert "없" in result.life_stage_code or "없" in result.description

    @pytest.mark.asyncio
    async def test_트랜잭션_없을때_fallback_반환(self):
        # Given: ML 사용 가능 + DB 유저 있음 + 트랜잭션 없음
        import pandas as pd

        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__  = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = (30,)  # age=30

        with patch("app.services.lifecycle_service.ML_AVAILABLE", True), \
             patch("app.services.lifecycle_service._load_model"), \
             patch("app.services.lifecycle_service.engine") as mock_engine, \
             patch("app.services.lifecycle_service.pd.read_sql", return_value=pd.DataFrame()):

            mock_engine.connect.return_value = mock_conn

            from app.services.lifecycle_service import predict_lifecycle
            from app.models.schemas import LifecycleRequest

            result = await predict_lifecycle(LifecycleRequest(user_id=1))

        # Then: 트랜잭션 없음 안내 반환
        assert "없" in result.description

    @pytest.mark.asyncio
    async def test_정상_예측시_DB에_저장됨(self):
        # Given: ML 정상 + 트랜잭션 있음 + 예측 결과 반환
        import pandas as pd

        fake_tx = pd.DataFrame([{
            "payment_category_id": 1,
            "payment_category": "식비",
            "payment_out": 50000,
            "payment_date": "2025-01-01",
            "payment_place": "스타벅스",
            "payment_time": "1200",
        }])

        mock_read_conn = MagicMock()
        mock_read_conn.__enter__ = MagicMock(return_value=mock_read_conn)
        mock_read_conn.__exit__  = MagicMock(return_value=False)
        mock_read_conn.execute.return_value.fetchone.return_value = (25,)

        mock_write_conn = MagicMock()
        mock_write_conn.__enter__ = MagicMock(return_value=mock_write_conn)
        mock_write_conn.__exit__  = MagicMock(return_value=False)

        fake_predict_result = {
            "lifecycle_code":  "NEW_JOB",
            "lifecycle_label": "사회초년생",
            "confidence":      0.85,
            "top3_candidates": [],
        }

        with patch("app.services.lifecycle_service.ML_AVAILABLE", True), \
             patch("app.services.lifecycle_service._load_model"), \
             patch("app.services.lifecycle_service.engine") as mock_engine, \
             patch("app.services.lifecycle_service.pd.read_sql", return_value=fake_tx), \
             patch("app.services.lifecycle_service.lifecycle_model") as mock_model:

            mock_engine.connect.return_value = mock_read_conn
            mock_engine.begin.return_value   = mock_write_conn
            mock_model.predict_from_transactions.return_value = fake_predict_result

            from app.services.lifecycle_service import predict_lifecycle
            from app.models.schemas import LifecycleRequest

            result = await predict_lifecycle(LifecycleRequest(user_id=1))

        # Then: 예측 결과 반환 + DB 저장 호출됨
        assert result.life_stage_code == "사회초년생"
        mock_write_conn.execute.assert_called_once()


# ══════════════════════════════════════════════════════════════
# 그룹 4: get_lifecycle — 조회 분기 (3개)
# ══════════════════════════════════════════════════════════════
class TestGetLifecycle:
    """
    get_lifecycle(user_id)
    - 유저 없음 / life_stage_code 비어있음 / 정상 조회 분기
    """

    @pytest.mark.asyncio
    async def test_유저_없을때_생애주기없음_반환(self):
        # Given: DB에 해당 유저 없음
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__  = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = None  # 유저 없음

        with patch("app.services.lifecycle_service.engine") as mock_engine:
            mock_engine.connect.return_value = mock_conn

            from app.services.lifecycle_service import get_lifecycle
            result = await get_lifecycle(user_id=999)

        # Then: 유저 없음 안내
        assert "없" in result.life_stage_code

    @pytest.mark.asyncio
    async def test_life_stage_code_없을때_예측_자동_트리거(self):
        # Given: 유저는 있는데 life_stage_code가 비어있음
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__  = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = (None,)  # code 없음

        fake_predicted = MagicMock()
        fake_predicted.life_stage_code = "사회초년생"

        with patch("app.services.lifecycle_service.engine") as mock_engine, \
             patch("app.services.lifecycle_service.predict_lifecycle",
                   new=AsyncMock(return_value=fake_predicted)):

            mock_engine.connect.return_value = mock_conn

            from app.services.lifecycle_service import get_lifecycle
            result = await get_lifecycle(user_id=1)

        # Then: predict_lifecycle 호출되어 예측 결과 반환
        assert result.life_stage_code == "사회초년생"

    @pytest.mark.asyncio
    async def test_정상_조회시_한글_라벨_변환됨(self):
        # Given: life_stage_code = "NEW_JOB" 저장되어 있음
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__  = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = ("NEW_JOB",)

        with patch("app.services.lifecycle_service.engine") as mock_engine:
            mock_engine.connect.return_value = mock_conn

            from app.services.lifecycle_service import get_lifecycle
            result = await get_lifecycle(user_id=1)

        # Then: "NEW_JOB" → "사회초년생" 한글 변환됨
        assert result.life_stage_code == "사회초년생"
