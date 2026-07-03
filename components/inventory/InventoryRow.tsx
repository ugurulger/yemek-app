import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InventoryItem } from '@/types/inventory';

interface InventoryRowProps {
  item: InventoryItem;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function InventoryRow({
  item,
  onIncrement,
  onDecrement,
  onDelete,
}: InventoryRowProps) {
  const isAtMin = item.qty <= 1;

  const formattedQty = Number.isInteger(item.qty)
    ? item.qty.toString()
    : item.qty.toFixed(1);

  return (
    <View className="flex-row items-center rounded-2xl bg-white p-3 ring-1 ring-stone-100 shadow-sm">
      <Text style={{ fontSize: 28 }} className="mr-3">
        {item.emoji}
      </Text>

      <View className="flex-1">
        <View className="flex-row items-center flex-wrap">
          <Text
            style={{ fontFamily: 'Outfit_500Medium' }}
            className="text-base text-stone-900"
          >
            {item.name}
          </Text>
          {item.confidence === 'low' && (
            <View className="ml-2 flex-row items-center rounded-full bg-amber-500 px-2 py-0.5">
              <Ionicons name="alert-circle-outline" size={12} color="white" />
              <Text
                style={{ fontFamily: 'Outfit_500Medium' }}
                className="ml-1 text-xs text-white"
              >
                Onayla
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{ fontFamily: 'Outfit_400Regular' }}
          className="mt-0.5 text-sm text-stone-500"
        >
          {formattedQty} {item.unit}
        </Text>
      </View>

      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} miktarını azalt`}
          disabled={isAtMin}
          onPress={() => onDecrement(item.id)}
          className={`h-8 w-8 items-center justify-center rounded-full bg-emerald-900 active:scale-95 ${
            isAtMin ? 'opacity-50' : ''
          }`}
        >
          <Ionicons name="remove" size={16} color="white" />
        </Pressable>

        <Text
          style={{ fontFamily: 'Outfit_500Medium' }}
          className="mx-2 min-w-[20px] text-center text-sm text-stone-900"
        >
          {formattedQty}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} miktarını artır`}
          onPress={() => onIncrement(item.id)}
          className="h-8 w-8 items-center justify-center rounded-full bg-emerald-900 active:scale-95"
        >
          <Ionicons name="add" size={16} color="white" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} ürününü sil`}
          onPress={() => onDelete(item.id)}
          className="ml-3 h-8 w-8 items-center justify-center rounded-full active:scale-95"
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}
