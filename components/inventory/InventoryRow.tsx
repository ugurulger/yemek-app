import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InventoryItem } from '@/types/inventory';

interface InventoryRowProps {
  item: InventoryItem;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onDelete: (id: string) => void;
  /** Verilirse +/- kontrolleri yerine "Envantere ekle" butonu gösterilir (bkz. "Emin olunamayan ürünler" bölümü). */
  onConfirm?: (id: string) => void;
}

export default function InventoryRow({
  item,
  onIncrement,
  onDecrement,
  onDelete,
  onConfirm,
}: InventoryRowProps) {
  const isAtMin = item.qty <= 1;

  const formattedQty = Number.isInteger(item.qty)
    ? item.qty.toString()
    : item.qty.toFixed(1);

  return (
    <View className="relative rounded-2xl bg-white p-3 ring-1 ring-stone-100 shadow-sm">
      {typeof item.confidence === 'number' && (
        <View className="absolute right-2 top-2 rounded-full bg-stone-100 px-2 py-0.5">
          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-xs text-stone-600">
            %{item.confidence}
          </Text>
        </View>
      )}

      <View className="flex-row items-center">
        <Text style={{ fontSize: 28 }} className="mr-3">
          {item.emoji}
        </Text>

        <View className="flex-1 pr-10">
          <Text
            style={{ fontFamily: 'Outfit_600SemiBold' }}
            className="text-base text-stone-900"
          >
            {item.name}
          </Text>
          {item.brand && (
            <Text
              style={{ fontFamily: 'Outfit_400Regular' }}
              className="text-xs text-stone-400"
            >
              {item.brand}
            </Text>
          )}
          <Text
            style={{ fontFamily: 'Outfit_400Regular' }}
            className="mt-0.5 text-sm text-stone-500"
          >
            {formattedQty} {item.unit}
          </Text>
        </View>

        <View className="flex-row items-center">
          {onConfirm ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} ürününü envantere ekle`}
              onPress={() => onConfirm(item.id)}
              className="rounded-2xl bg-emerald-900 px-3 py-2 active:scale-95"
            >
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-xs text-white">
                Envantere ekle
              </Text>
            </Pressable>
          ) : (
            <>
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
            </>
          )}

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
    </View>
  );
}
