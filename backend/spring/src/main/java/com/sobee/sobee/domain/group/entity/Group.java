package com.sobee.sobee.domain.group.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "groupss")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "group_name", length = 50)
    private String groupName;

    @Column(name = "group_description", length = 200)
    private String groupDescription;

    @Column(name = "group_code", length = 15)
    private String groupCode;

    @Column(name = "max")
    private Integer max;
}