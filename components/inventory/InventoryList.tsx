import React from 'react';
import { FlatList, View } from 'react-native';
import type { InventoryItem } from '@/types/inventory';
import InventoryRow from './InventoryRow';

interface InventoryListProps {
  items: InventoryItem[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirm?: (id: string) => void;
}

export default function InventoryList({
  items,
  onIncrement,
  onDecrement,
  onDelete,
  onConfirm,
}: InventoryListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <InventoryRow
          item={item}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onDelete={onDelete}
          onConfirm={onConfirm}
        />
      )}
      ItemSeparatorComponent={() => <View className="h-2" />}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
