package com.sobee.sobee.domain.product.dto;

import lombok.Getter;

@Getter
public class SearchRequestDto {
    private String search_input;
    private Long user_id;
}