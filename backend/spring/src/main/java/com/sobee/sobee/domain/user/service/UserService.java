package com.sobee.sobee.domain.user.service;

import com.sobee.sobee.domain.user.dto.UserPersonaDto;
import com.sobee.sobee.domain.user.dto.UserRequestDto;
import com.sobee.sobee.domain.user.entity.User;
import com.sobee.sobee.domain.user.repository.UserRepository;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    public void register(UserRequestDto dto) {
        User user = User.builder()
                .name(dto.getName())
                .email(dto.getEmail())
                .gender(dto.getGender())
                .age(dto.getAge())
                .createdAt(LocalDateTime.now())
                .build();
        userRepository.save(user);
    }

    public String login(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("이메일이 없습니다."));
        return jwtUtil.generateToken(user.getUserId(), user.getEmail());
    }

    public UserPersonaDto getPersona(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        return new UserPersonaDto(user.getAvatarName(), user.getAvatarExplane(), user.getAvatarImgUrl());
    }
}