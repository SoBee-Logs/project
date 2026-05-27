package com.sobee.sobee.domain.product.config;

import com.sobee.sobee.domain.product.entity.InsuranceProduct;
import com.sobee.sobee.domain.product.repository.InsuranceProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class InsuranceDataLoader implements CommandLineRunner {

    private final InsuranceProductRepository repo;

    @Override
    public void run(String... args) {
        if (repo.count() > 0) {
            log.info("⏭ 미니보험 데이터 이미 존재 ({} 건), 스킵", repo.count());
            return;
        }

        try {
            ClassPathResource resource = new ClassPathResource("data/mini_insurance.csv");
            if (!resource.exists()) {
                log.info("⏭ mini_insurance.csv 파일 없음, 스킵");
                return;
            }

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8));

            // 첫 줄(그룹 헤더), 두 번째 줄(컬럼 헤더) 스킵
            reader.readLine();
            reader.readLine();

            String line;
            int count = 0;

            while ((line = reader.readLine()) != null) {
                String[] cols = parseCsvLine(line);
                if (cols.length < 14) continue;

                String productId = cols[0].trim();
                if (productId.isEmpty() || productId.startsWith("▶")) continue;

                InsuranceProduct p = InsuranceProduct.builder()
                        .productId(productId)
                        .productName(cols[1].trim())
                        .insurer(cols[2].trim())
                        .category(cols[3].trim())
                        .situationTags(cols[4].trim())
                        .coveragePeriodDays(parseIntSafe(cols[5].trim()))
                        .ageMin(parseIntSafe(cols[6].trim()))
                        .ageMax(parseIntSafe(cols[7].trim()))
                        .gender(cols[8].trim())
                        .description(cols[9].trim())
                        .productUrl(cols[10].trim())
                        .isMiniInsurance("Y".equalsIgnoreCase(cols[11].trim()))
                        .notes(cols[12].trim())
                        .syncedAt(LocalDateTime.now())
                        .build();

                repo.save(p);
                count++;
            }

            reader.close();
            log.info("✅ 미니보험 CSV 로딩 완료: {}건", count);

        } catch (Exception e) {
            log.warn("⚠️ 미니보험 CSV 로딩 실패: {}", e.getMessage());
        }
    }

    private Integer parseIntSafe(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder sb = new StringBuilder();

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        result.add(sb.toString());
        return result.toArray(new String[0]);
    }
}