package com.sobee.sobee.domain.product.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter
@Builder
public class SearchResponseDto {
    private String AI_text;
    private List<ProductDto> products;

    @Getter
    @Builder
    public static class ProductDto {
        private String product_name;
        private String product_company;
        private String product_img_url;
        private String product_type;  // "card" | "savings" | "insurance"
        private Boolean is_discontinued;
        private ContentDto content;
    }

    @Getter
    @Builder
    public static class ContentDto {
        private String header;
        private String middle;
        private String small;
        private String url;
    }
}