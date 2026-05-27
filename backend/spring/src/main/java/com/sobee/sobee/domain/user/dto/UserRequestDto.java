package com.sobee.sobee.domain.user.dto;

import lombok.Getter;

@Getter
public class UserRequestDto {
    private String name;
    private String email;
    private String gender;
    private Integer age;
}