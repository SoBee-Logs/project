package com.sobee.sobee.domain.product.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

public class SavingsApiDto {

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class BaseItem {
        private String fin_prdt_cd;
        private String kor_co_nm;
        private String fin_prdt_nm;
        private String join_way;
        private String mtrt_int;
        private String spcl_cnd;
        private String join_member;
        private String etc_note;
        private String dcls_strt_day;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class OptionItem {
        private String fin_prdt_cd;
        private String intr_rate_type;
        private Integer save_trm;
        private BigDecimal intr_rate;
        private BigDecimal intr_rate2;
    }

    @Getter @Setter @NoArgsConstructor
    public static class ApiResponse {
        private Result result;
    }

    @Getter @Setter @NoArgsConstructor
    public static class Result {
        private List<BaseItem> baseList;
        private List<OptionItem> optionList;
    }
}