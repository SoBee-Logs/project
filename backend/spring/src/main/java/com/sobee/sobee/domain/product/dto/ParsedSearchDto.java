package com.sobee.sobee.domain.product.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.List;

@Getter
@NoArgsConstructor
public class ParsedSearchDto {
    private List<String> product_types;
    private String company;
    private String category;
    private List<String> keywords;
    private String ai_text;
}
