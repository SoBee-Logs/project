package com.sobee.sobee.domain.product.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sobee.sobee.domain.product.entity.*;
import com.sobee.sobee.domain.product.repository.CardInfoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class CardSyncService {

    private final CardInfoRepository cardInfoRepository;
    private final ObjectMapper objectMapper;

    /**
     * resources/data/cards.json 파일을 읽어 DB에 적재
     * Python 크롤러가 생성한 cards_0508.json을 cards.json으로 이름 바꿔서 넣어주세요
     */
    @Transactional
    public int syncFromJson() {
        try {
            ClassPathResource resource = new ClassPathResource("data/cards.json");
            if (!resource.exists()) {
                log.warn("⏭ cards.json 파일 없음, 스킵");
                return 0;
            }

            InputStream is = resource.getInputStream();
            JsonNode root = objectMapper.readTree(is);

            if (!root.isArray()) {
                log.error("❌ cards.json 형식 오류: 배열이어야 합니다");
                return 0;
            }

            int count = 0;
            for (JsonNode node : root) {
                try {
                    saveCard(node);
                    count++;
                } catch (Exception e) {
                    log.warn("⚠️ 카드 저장 실패 (ID {}): {}", node.path("id").asInt(), e.getMessage());
                }
            }

            log.info("✅ 카드 데이터 적재 완료: {}건", count);
            return count;

        } catch (Exception e) {
            log.error("❌ cards.json 로딩 실패: {}", e.getMessage());
            throw new RuntimeException("카드 데이터 로딩 실패", e);
        }
    }

    private void saveCard(JsonNode node) {
        int gorillaId = node.path("id").asInt();

        // 이미 존재하면 업데이트, 없으면 신규 생성
        CardInfo card = cardInfoRepository.findByGorillaId(gorillaId)
                .orElse(CardInfo.builder().gorillaId(gorillaId).build());

        card.setCardName(node.path("card_name").asText());
        card.setCorpId(node.path("corp_id").asInt());
        card.setCorpName(node.path("corp_name").asText());
        card.setCardType(node.path("card_type").asText("credit"));
        card.setCType(nullableText(node, "c_type"));
        card.setAnnualFeeBasic(nullableText(node, "annual_fee_basic"));
        card.setAnnualFeeDetail(nullableText(node, "annual_fee_detail"));
        card.setMinPerformance(node.path("min_performance").asInt(0));
        card.setOnlyOnline(node.path("only_online").asBoolean(false));
        card.setCardImgUrl(nullableText(node, "card_img_url"));
        card.setIsDiscontinued(node.path("is_discontinued").asBoolean(false));
        card.setIsImpend(node.path("is_impend").asBoolean(false));
        card.setReleaseDt(parseDate(nullableText(node, "release_dt")));
        card.setSyncedAt(LocalDateTime.now());

        // 기존 연관 데이터 초기화 (재동기화 시 중복 방지)
        card.getBrands().clear();
        card.getBenefits().clear();
        card.getTopBenefits().clear();

        // 브랜드
        JsonNode brands = node.path("brands");
        if (brands.isArray()) {
            for (JsonNode b : brands) {
                card.addBrand(CardBrand.builder()
                        .brandName(b.path("brand_name").asText())
                        .brandCode(nullableText(b, "brand_code"))
                        .logoUrl(nullableText(b, "logo_url"))
                        .build());
            }
        }

        // 혜택
        JsonNode benefits = node.path("benefits");
        if (benefits.isArray()) {
            for (JsonNode b : benefits) {
                card.addBenefit(CardBenefit.builder()
                        .cateIdx(b.path("cate_idx").isNull() ? null : b.path("cate_idx").asInt())
                        .cateName(nullableText(b, "cate_name"))
                        .title(nullableText(b, "title"))
                        .comment(nullableText(b, "comment"))
                        .infoText(nullableText(b, "info_text"))
                        .isNotice(b.path("is_notice").asBoolean(false))
                        .build());
            }
        }

        // 대표 혜택
        JsonNode topBenefits = node.path("top_benefits");
        if (topBenefits.isArray()) {
            for (JsonNode tb : topBenefits) {
                card.addTopBenefit(CardTopBenefit.builder()
                        .title(nullableText(tb, "title"))
                        .tags(tb.path("tags").toString())  // JSON 배열 → String
                        .build());
            }
        }

        cardInfoRepository.save(card);
    }

    private String nullableText(JsonNode node, String field) {
        JsonNode val = node.path(field);
        return (val.isNull() || val.isMissingNode()) ? null : val.asText();
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } catch (Exception e) {
            return null;
        }
    }
}