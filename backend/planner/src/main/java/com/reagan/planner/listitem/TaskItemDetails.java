package com.reagan.planner.listitem;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "task_item_details")
@Getter
@Setter
@NoArgsConstructor
public class TaskItemDetails {

    @Id
    @Column(name = "item_id")
    private Long itemId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "item_id")
    private ListItem item;

    @Column(length = 50)
    private String priority;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(length = 50)
    private String status;
}