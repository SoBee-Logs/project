package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.dto.SavingsApiDto;
import com.sobee.sobee.domain.product.entity.SavingsProduct;
import com.sobee.sobee.domain.product.repository.SavingsProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SavingsProductSyncService {

    private final SavingsProductRepository savingsRepo;
    private final RestTemplate restTemplate;

    @Value("${finance.api.key}")
    private String apiKey;

    private static final String DEPOSIT_URL =
            "https://finlife.fss.or.kr/finlifeapi/depositProductsSearch.json?auth=%s&topFinGrpNo=020000&pageNo=%d";
    private static final String SAVING_URL =
            "https://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json?auth=%s&topFinGrpNo=020000&pageNo=%d";

    @Transactional
    public int syncAll() {
        int count = 0;
        count += syncProducts(DEPOSIT_URL, "정기예금");
        count += syncProducts(SAVING_URL, "적금");
        log.info("✅ 예적금 동기화 완료: 총 {}건", count);
        return count;
    }

    private int syncProducts(String urlTemplate, String type) {
        int page = 1;
        int totalSaved = 0;

        while (true) {
            String url = String.format(urlTemplate, apiKey, page);
            SavingsApiDto.ApiResponse response = restTemplate.getForObject(url, SavingsApiDto.ApiResponse.class);

            if (response == null || response.getResult() == null) break;

            List<SavingsApiDto.BaseItem> baseList = response.getResult().getBaseList();
            List<SavingsApiDto.OptionItem> optionList = response.getResult().getOptionList();

            if (baseList == null || baseList.isEmpty()) break;

            Map<String, SavingsApiDto.BaseItem> baseMap = baseList.stream()
                    .collect(Collectors.toMap(
                            SavingsApiDto.BaseItem::getFin_prdt_cd,
                            b -> b,
                            (a, b) -> a
                    ));

            if (optionList != null) {
                for (SavingsApiDto.OptionItem opt : optionList) {
                    SavingsApiDto.BaseItem base = baseMap.get(opt.getFin_prdt_cd());
                    if (base == null) continue;

                    SavingsProduct entity = savingsRepo
                            .findByFinPrdtCdAndSaveTrm(opt.getFin_prdt_cd(), opt.getSave_trm())
                            .orElse(new SavingsProduct());

                    entity.setFinPrdtCd(base.getFin_prdt_cd());
                    entity.setKorCoNm(base.getKor_co_nm());
                    entity.setFinPrdtNm(base.getFin_prdt_nm());
                    entity.setJoinWay(base.getJoin_way());
                    entity.setMtrtInt(base.getMtrt_int());
                    entity.setSpclCnd(base.getSpcl_cnd());
                    entity.setJoinMember(base.getJoin_member());
                    entity.setEtcNote(base.getEtc_note());
                    if (base.getDcls_strt_day() != null && !base.getDcls_strt_day().isEmpty()) {
                        entity.setDclsStrtDay(
                                LocalDate.parse(base.getDcls_strt_day(), DateTimeFormatter.ofPattern("yyyyMMdd"))
                        );
                    }

                    entity.setSaveTrm(opt.getSave_trm());
                    entity.setIntrRate(opt.getIntr_rate());
                    entity.setIntrMaxRate(opt.getIntr_rate2());
                    entity.setIntrRateType(opt.getIntr_rate_type());
                    entity.setSyncedAt(LocalDateTime.now());

                    savingsRepo.save(entity);
                    totalSaved++;
                }
            }

            page++;
            if (page > 10) break;
        }

        log.info("📦 {} 동기화: {}건", type, totalSaved);
        return totalSaved;
    }
}