package com.reagan.planner.listitem;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "packing_item_details")
@Getter
@Setter
@NoArgsConstructor
public class PackingItemDetails {

    @Id
    @Column(name = "item_id")
    private Long itemId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "item_id")
    private ListItem item;

    @Column
    private Integer quantity;

    @Column(length = 100)
    private String category;

    @Column(nullable = false)
    private boolean essential;
}