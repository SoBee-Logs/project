from pydantic import BaseModel
from typing import Optional, List, Literal

# 아바타
class AvatarRequest(BaseModel):
    user_id: int

class AvatarResponse(BaseModel):
    avatar_title: str
    avatar_description: str
    avatar_image: str  # S3 URL, 16:9 PNG, character + background combined

# 금융상품 추천
class RecommendRequest(BaseModel):
    user_id: int
    query: str
    life_stage_code: Optional[str] = None

class RecommendResponse(BaseModel):
    product_id: int
    product_name: str
    reason: str

# LifecycleRequest
class LifecycleRequest(BaseModel):
    user_id: int                           

# LifecycleResponse
class LifecycleResponse(BaseModel):
    life_stage_code: str
    description: str

# 내부 파이프라인
class SyncRequest(BaseModel):
    user_id: int
    days: Optional[int] = None  # None → daily default (3일), 30 → 최초 가입 시

class SyncResponse(BaseModel):
    message: str

class MappingRequest(BaseModel):
    user_id: int

class MappingResponse(BaseModel):
    message: str

class PersonaGenerateRequest(BaseModel):
    user_id: int
    start_date: Optional[str] = None  # 없으면 지난주 월~일 자동 적용
    end_date: Optional[str] = None

class RegisterAccountRequest(BaseModel):
    user_id: int
    business_type: str   # "BK" | "CD"
    org_code: str        # 기관코드 e.g. "0020"
    login_id: str
    login_pw: str

class RegisterAccountResponse(BaseModel):
    user_id: int
    business_type: str
    org_code: str
    message: str

class DiaryGenerateRequest(BaseModel):
    user_id: int

class DiaryGenerateResponse(BaseModel):
    message: str

# 카테고리 매핑 (표준 16개 카테고리)
class CategoryResolveRequest(BaseModel):
    payment_category: str                  
    payment_place: Optional[str] = None    

class CategoryResolveResponse(BaseModel):
    payment_category_id: int                     
    category_name: str                    
    matched_by: Literal["tier2", "tier1", "etc"]
    # tier2 = (유형+가맹점명) 매칭 / tier1 = 유형만 매칭 / etc = 매핑 실패

# AI 상품 추천
class BenefitLine(BaseModel):
    title: Optional[str] = None
    comment: Optional[str] = None

class BenefitGroup(BaseModel):
    cateName: str
    lines: List[BenefitLine]

class AiInsightContent(BaseModel):
    header: Optional[str] = None
    middle: Optional[str] = None
    small: Optional[str] = None
    url: Optional[str] = None
    # 카드 rich fields
    benefitGroups: Optional[List[BenefitGroup]] = None
    annualFeeDetail: Optional[str] = None
    onlyOnline: Optional[bool] = None
    isImpend: Optional[bool] = None
    # 예적금 rich fields
    intrRate: Optional[str] = None
    intrRateType: Optional[str] = None
    joinWay: Optional[str] = None
    joinMember: Optional[str] = None
    etcNote: Optional[str] = None
    mtrtInt: Optional[str] = None

class AiInsightItem(BaseModel):
    product_name: str
    product_company: str
    product_img_url: Optional[str] = None
    product_type: str  # 'card' | 'savings'
    reason: Optional[str] = None
    content: Optional[AiInsightContent] = None

class AiInsightResponse(BaseModel):
    recommned: List[AiInsightItem]  # 스펙 오타 유지
    message: Optional[str] = None

# 검색 AI 분석 텍스트
class SearchProduct(BaseModel):
    product_name: str
    product_type: str  # card | savings | insurance
    header: Optional[str] = None

class AiSearchTextRequest(BaseModel):
    query: str
    user_id: int
    products: List[SearchProduct]

class AiSearchTextResponse(BaseModel):
    ai_text: str

# 시멘틱 검색 쿼리 파싱
class ParseSearchRequest(BaseModel):
    query: str

class ParseSearchResponse(BaseModel):
    product_types: List[str]
    company: Optional[str] = None
    category: Optional[str] = None
    keywords: List[str]
    ai_text: str

# VLM 소비 일기 생성 (diary 레포 이식)
class DiaryRequest(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[int] = None
    store_name: Optional[str] = None
    description: Optional[str] = None
    mood: Optional[str] = None
    emotion_text: Optional[str] = None
    matched: Optional[bool] = None
    tags: Optional[List[str]] = []
    group_description: Optional[str] = None

class DiaryResponse(BaseModel):
    title: str
    diary_lines: List[str]
    tags: List[str]