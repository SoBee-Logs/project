package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.document.CardDocument;
import com.sobee.sobee.domain.product.document.InsuranceDocument;
import com.sobee.sobee.domain.product.document.SavingsDocument;
import com.sobee.sobee.domain.product.entity.CardBenefit;
import com.sobee.sobee.domain.product.entity.CardInfo;
import com.sobee.sobee.domain.product.entity.CardTopBenefit;
import com.sobee.sobee.domain.product.entity.InsuranceProduct;
import com.sobee.sobee.domain.product.entity.SavingsProduct;
import com.sobee.sobee.domain.product.repository.CardInfoRepository;
import com.sobee.sobee.domain.product.repository.InsuranceProductRepository;
import com.sobee.sobee.domain.product.repository.SavingsProductRepository;
import com.sobee.sobee.domain.product.repository.es.CardSearchRepository;
import com.sobee.sobee.domain.product.repository.es.InsuranceSearchRepository;
import com.sobee.sobee.domain.product.repository.es.SavingsSearchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ElasticsearchIndexService {

    private final CardInfoRepository cardInfoRepository;
    private final SavingsProductRepository savingsProductRepository;
    private final InsuranceProductRepository insuranceProductRepository;

    @Lazy @Autowired private CardSearchRepository cardSearchRepository;
    @Lazy @Autowired private SavingsSearchRepository savingsSearchRepository;
    @Lazy @Autowired private InsuranceSearchRepository insuranceSearchRepository;

    public ElasticsearchIndexService(
            CardInfoRepository cardInfoRepository,
            SavingsProductRepository savingsProductRepository,
            InsuranceProductRepository insuranceProductRepository) {
        this.cardInfoRepository = cardInfoRepository;
        this.savingsProductRepository = savingsProductRepository;
        this.insuranceProductRepository = insuranceProductRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void indexAll() {
        try {
            indexCards();
            indexSavings();
            indexInsurance();
        } catch (Exception e) {
            log.warn("⚠️ ES 인덱싱 실패 (ES가 실행 중인지 확인하세요): {}", e.getMessage());
        }
    }

    public void indexCards() {
        // MultipleBagFetchException 방지: 쿼리를 두 번으로 분리
        List<CardInfo> cardsWithBenefits = cardInfoRepository.findAllWithBenefits();

        Map<Long, List<String>> topBenefitsMap = cardInfoRepository.findAllWithTopBenefits().stream()
                .collect(Collectors.toMap(
                        CardInfo::getCardInfoId,
                        c -> c.getTopBenefits().stream()
                                .map(CardTopBenefit::getTitle)
                                .filter(Objects::nonNull)
                                .collect(Collectors.toList())
                ));

        List<CardDocument> docs = cardsWithBenefits.stream()
                .map(c -> CardDocument.builder()
                        .id(String.valueOf(c.getCardInfoId()))
                        .gorillaId(c.getGorillaId())
                        .cardName(c.getCardName())
                        .corpName(c.getCorpName())
                        .cardType(c.getCardType())
                        .annualFeeBasic(c.getAnnualFeeBasic())
                        .minPerformance(c.getMinPerformance())
                        .cardImgUrl(c.getCardImgUrl())
                        .isDiscontinued(c.getIsDiscontinued())
                        .cateNames(c.getBenefits().stream()
                                .map(CardBenefit::getCateName)
                                .filter(Objects::nonNull)
                                .distinct()
                                .collect(Collectors.toList()))
                        .topBenefitTitles(topBenefitsMap.getOrDefault(c.getCardInfoId(), List.of()))
                        .build())
                .collect(Collectors.toList());

        cardSearchRepository.saveAll(docs);
        log.info("✅ 카드 {}건 ES 인덱싱 완료", docs.size());
    }

    public void indexSavings() {
        List<SavingsDocument> docs = savingsProductRepository.findAll().stream()
                .map(s -> SavingsDocument.builder()
                        .id(String.valueOf(s.getSavingsId()))
                        .finPrdtNm(s.getFinPrdtNm())
                        .korCoNm(s.getKorCoNm())
                        .saveTrm(s.getSaveTrm())
                        .intrRate(s.getIntrRate())
                        .intrMaxRate(s.getIntrMaxRate())
                        .spclCnd(s.getSpclCnd())
                        .build())
                .collect(Collectors.toList());
        savingsSearchRepository.saveAll(docs);
        log.info("✅ 예적금 {}건 ES 인덱싱 완료", docs.size());
    }

    public void indexInsurance() {
        List<InsuranceDocument> docs = insuranceProductRepository.findAll().stream()
                .map(i -> InsuranceDocument.builder()
                        .id(i.getProductId())
                        .productName(i.getProductName())
                        .insurer(i.getInsurer())
                        .category(i.getCategory())
                        .situationTags(i.getSituationTags())
                        .description(i.getDescription())
                        .coveragePeriodDays(i.getCoveragePeriodDays())
                        .productUrl(i.getProductUrl())
                        .build())
                .collect(Collectors.toList());
        insuranceSearchRepository.saveAll(docs);
        log.info("✅ 보험 {}건 ES 인덱싱 완료", docs.size());
    }
}
