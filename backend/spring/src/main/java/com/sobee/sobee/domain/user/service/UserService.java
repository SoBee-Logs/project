package com.sobee.sobee.domain.user.service;

import com.sobee.sobee.domain.user.dto.UserPersonaDto;
import com.sobee.sobee.domain.user.dto.UserRequestDto;
import com.sobee.sobee.domain.user.entity.Avatar;
import com.sobee.sobee.domain.user.entity.User;
import com.sobee.sobee.domain.user.repository.AvatarRepository;
import com.sobee.sobee.domain.user.repository.UserRepository;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final AvatarRepository avatarRepository;
    private final JwtUtil jwtUtil;

    public void register(UserRequestDto dto) {
        // 이메일 중복 확인
        if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new RuntimeException("이미 가입된 이메일입니다.");
        }
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
        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new RuntimeException("탈퇴한 계정입니다.");
        }
        return jwtUtil.generateToken(user.getUserId(), user.getEmail());
    }

    public UserPersonaDto getPersona(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        // 가입일을 ISO 문자열로 변환 (프론트 minDate 설정용)
        String createdAt = user.getCreatedAt() != null
                ? user.getCreatedAt().toString()
                : null;
        Avatar avatar = avatarRepository.findTopByUserIdOrderByAvatarCreatedAtDesc(userId)
                .orElse(null);
        if (avatar == null) return new UserPersonaDto(null, null, null, null, createdAt);
        return new UserPersonaDto(avatar.getAvatarName(), avatar.getAvatarExplain(), avatar.getAvatarImgUrl(), avatar.getAvatarChangeReason(), createdAt);
    }

    // 회원 탈퇴 — Soft Delete (is_active = false)
    @Transactional
    public void deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        user.setIsActive(false);
    }
}