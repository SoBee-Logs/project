// domain/b_log/entity/PhotoGroupsId.java
package com.sobee.sobee.domain.b_log.entity;

import jakarta.persistence.Embeddable;
import lombok.*;
import java.io.Serializable;

@Embeddable
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class PhotoGroupsId implements Serializable {
    private Long photoId;
    private Long groupId;
}