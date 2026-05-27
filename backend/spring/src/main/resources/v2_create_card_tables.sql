-- ============================================================
-- 카드 관련 테이블 DDL (MySQL)
-- card_info, card_benefits, card_top_benefits, card_brands
-- ============================================================

-- 1. 카드 정보 테이블
CREATE TABLE IF NOT EXISTS card_info (
                                         card_info_id     BIGINT        NOT NULL AUTO_INCREMENT,
                                         gorilla_id       INT           NOT NULL COMMENT '카드고릴라 카드 ID',
                                         card_name        VARCHAR(200)  NOT NULL COMMENT '카드명',
    corp_id          INT           NOT NULL COMMENT '카드사 ID',
    corp_name        VARCHAR(100)  NOT NULL COMMENT '카드사명',
    card_type        VARCHAR(20)   NOT NULL COMMENT 'credit / check',
    c_type           VARCHAR(10)   NULL     COMMENT '카드 세부 타입 코드',
    annual_fee_basic VARCHAR(200)  NULL     COMMENT '기본 연회비 요약',
    annual_fee_detail TEXT         NULL     COMMENT '연회비 상세 (HTML 제거)',
    min_performance  INT           NULL     DEFAULT 0 COMMENT '전월 실적 조건',
    only_online      TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '온라인 전용 여부',
    card_img_url     VARCHAR(500)  NULL     COMMENT '카드 이미지 URL',
    is_discontinued  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '단종 여부',
    is_impend        TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '출시 예정 여부',
    release_dt       DATE          NULL     COMMENT '출시일',
    synced_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (card_info_id),
    UNIQUE KEY uk_gorilla_id (gorilla_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='카드 기본 정보 (카드고릴라)';


-- 2. 카드 브랜드 테이블 (VISA, Mastercard 등)
CREATE TABLE IF NOT EXISTS card_brands (
                                           brand_id    BIGINT       NOT NULL AUTO_INCREMENT,
                                           card_info_id BIGINT      NOT NULL COMMENT 'FK → card_info',
                                           brand_name  VARCHAR(50)  NOT NULL COMMENT 'VISA, Mastercard 등',
    brand_code  VARCHAR(50)  NULL,
    logo_url    VARCHAR(500) NULL,
    PRIMARY KEY (brand_id),
    KEY idx_brand_card (card_info_id),
    CONSTRAINT fk_brand_card
    FOREIGN KEY (card_info_id) REFERENCES card_info (card_info_id)
    ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='카드 브랜드';


-- 3. 카드 혜택 테이블
CREATE TABLE IF NOT EXISTS card_benefits (
                                             card_ben_id     BIGINT        NOT NULL AUTO_INCREMENT,
                                             card_info_id    BIGINT        NOT NULL COMMENT 'FK → card_info',
                                             cate_idx        INT           NULL     COMMENT '혜택 카테고리 ID',
                                             cate_name       VARCHAR(100)  NULL     COMMENT '혜택 카테고리명',
    title           VARCHAR(200)  NULL     COMMENT '혜택 제목',
    comment         TEXT          NULL     COMMENT '혜택 요약',
    info_text       TEXT          NULL     COMMENT '혜택 상세 (HTML 제거)',
    is_notice       TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '유의사항 여부',
    PRIMARY KEY (card_ben_id),
    KEY idx_benefit_card (card_info_id),
    CONSTRAINT fk_benefit_card
    FOREIGN KEY (card_info_id) REFERENCES card_info (card_info_id)
    ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='카드 혜택';


-- 4. 카드 주요 혜택 테이블 (top_benefit)
CREATE TABLE IF NOT EXISTS card_top_benefits (
                                                 card_big_ben_id BIGINT        NOT NULL AUTO_INCREMENT,
                                                 card_info_id    BIGINT        NOT NULL COMMENT 'FK → card_info',
                                                 title           VARCHAR(100)  NULL     COMMENT '대표 혜택 제목',
    tags            JSON          NULL     COMMENT '혜택 태그 배열',
    PRIMARY KEY (card_big_ben_id),
    KEY idx_top_benefit_card (card_info_id),
    CONSTRAINT fk_top_benefit_card
    FOREIGN KEY (card_info_id) REFERENCES card_info (card_info_id)
    ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='카드 주요 혜택';