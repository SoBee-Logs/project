-- ============================================================
-- 금융상품 테이블 DDL (MySQL)
-- ============================================================

-- 1. 예적금 상품 테이블
CREATE TABLE IF NOT EXISTS savings_products (
                                                savings_id    BIGINT        NOT NULL AUTO_INCREMENT,
                                                fin_prdt_cd   VARCHAR(20)   NOT NULL COMMENT '금융상품코드',
    kor_co_nm     VARCHAR(100)  NOT NULL COMMENT '금융회사명',
    fin_prdt_nm   VARCHAR(200)  NOT NULL COMMENT '상품명',
    join_way      VARCHAR(200)  NULL     COMMENT '가입방법',
    mtrt_int      TEXT          NULL     COMMENT '만기후이자율',
    spcl_cnd      TEXT          NULL     COMMENT '우대조건',
    join_member   VARCHAR(200)  NULL     COMMENT '가입대상',
    etc_note      TEXT          NULL     COMMENT '기타유의사항',
    dcls_strt_day DATE          NULL     COMMENT '공시시작일',
    save_trm      INT           NULL     COMMENT '저축기간(월)',
    intr_rate     DECIMAL(5,2)  NULL     COMMENT '기본금리',
    intr_max_rate DECIMAL(5,2)  NULL     COMMENT '최고우대금리',
    intr_rate_type VARCHAR(10)  NULL     COMMENT '금리유형 (S:단리, M:복리)',
    synced_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (savings_id),
    UNIQUE KEY uk_savings_prdt_trm (fin_prdt_cd, save_trm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 미니보험 상품 테이블
CREATE TABLE IF NOT EXISTS insurance_products (
                                                  product_id            VARCHAR(50)   NOT NULL,
    product_name          VARCHAR(100)  NOT NULL COMMENT '보험 상품명',
    insurer               VARCHAR(50)   NOT NULL COMMENT '보험사',
    category              VARCHAR(50)   NULL     COMMENT '카테고리',
    situation_tags        TEXT          NULL     COMMENT '상황 키워드',
    description           TEXT          NULL     COMMENT '보험 줄글 설명',
    coverage_period_days  INT           NULL     COMMENT '최대 보험기간(일수)',
    age_min               INT           NULL     COMMENT '가입 최소 나이',
    age_max               INT           NULL     COMMENT '가입 최대 나이',
    gender                VARCHAR(10)   NULL     COMMENT '성별 제한',
    is_mini_insurance     TINYINT(1)    NOT NULL DEFAULT 1,
    product_url           VARCHAR(500)  NULL     COMMENT '상품 URL',
    notes                 TEXT          NULL     COMMENT '비고',
    synced_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 미니보험 보장항목 테이블
CREATE TABLE IF NOT EXISTS insurance_coverages (
                                                   coverage_id    BIGINT       NOT NULL AUTO_INCREMENT,
                                                   product_id     VARCHAR(50)  NOT NULL,
    item_name      VARCHAR(100) NOT NULL COMMENT '보장항목명',
    condition_text TEXT         NULL     COMMENT '보장 조건',
    exclusion_text TEXT         NULL     COMMENT '예외 조건',
    PRIMARY KEY (coverage_id),
    KEY idx_coverage_product (product_id),
    CONSTRAINT fk_coverage_product
    FOREIGN KEY (product_id) REFERENCES insurance_products (product_id)
    ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;