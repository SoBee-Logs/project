package com.sobee.sobee.domain.group.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_group")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "group_id")
    private Long groupId;
}