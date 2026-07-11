import { Pressable, Text, View } from 'react-native';

import type { ChefChatMessage } from '@/store/chefChatStore';

export interface ChefChatProps {
  messages: ChefChatMessage[];
  /** Şef yanıtı beklenirken "Şef yazıyor..." göstergesi. */
  isTyping: boolean;
  /** Örnek soru chip'ine dokununca — soru gerçek gönderim akışından geçer. */
  onPressExample?: (text: string) => void;
}

/** Sohbet boşken gösterilen örnek soru chip'leri. */
const EXAMPLE_QUESTIONS = [
  'Kremam yok, ne kullanabilirim?',
  'Daha hafif olur mu?',
  'Kaç kişilik?',
] as const;

/** Şef balonu gölgesi — referans: 0 2px 8px -4px rgba(31,74,61,.14). */
const CHEF_BUBBLE_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.14,
  shadowRadius: 4,
  elevation: 2,
} as const;

/**
 * Şefe Sor bölümü — BİREBİR referans (SCREEN 3): 28×28 radius 9 forest ✦
 * ikon kutusu + "Şefe Sor" (Newsreader 500 15px) + alt metin (400 11px),
 * mb 12; balonlar dikey gap 10, mb 14 — kullanıcı sağda forest balon
 * (radius 18/18/4/18), şef solda beyaz gölgeli balon (radius 18/18/18/4).
 * Giriş çubuğu ekranın altına sabit olduğu için BU bileşende değildir
 * (bkz. app/recipe/[id].tsx).
 */
export default function ChefChat({ messages, isTyping, onPressExample }: ChefChatProps) {
  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-[9px] bg-forest">
          <Text className="text-[14px] text-white">✦</Text>
        </View>
        <View>
          <Text className="font-serif text-[15px] text-ink">Şefe Sor</Text>
          <Text className="font-sans text-[11px] text-muted">
            Malzeme değişimi ve tarif soruları
          </Text>
        </View>
      </View>

      {/* Örnek soru chip'leri — SADECE sohbet geçmişi boşken */}
      {messages.length === 0 && !isTyping && onPressExample && (
        <View className="mb-3.5 flex-row flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((question) => (
            <Pressable
              key={question}
              accessibilityRole="button"
              accessibilityLabel={`Şefe sor: ${question}`}
              onPress={() => onPressExample(question)}
              className="rounded-[20px] bg-white px-3 py-2 active:scale-95"
              style={{ borderWidth: 1, borderColor: 'rgba(31,74,61,0.22)' }}>
              <Text className="font-sans-medium text-[12px] text-muted">{question}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {(messages.length > 0 || isTyping) && (
        <View className="mb-3.5 gap-2.5">
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <View
                key={`${message.createdAt}-${index}`}
                className="max-w-[80%] self-end rounded-[18px] rounded-br-[4px] bg-forest px-3.5 py-[11px]">
                <Text className="font-sans text-[13.5px] leading-[19.5px] text-white">
                  {message.content}
                </Text>
              </View>
            ) : (
              <View
                key={`${message.createdAt}-${index}`}
                className="max-w-[82%] self-start rounded-[18px] rounded-bl-[4px] bg-white px-3.5 py-[11px]"
                style={CHEF_BUBBLE_SHADOW}>
                <Text className="font-sans text-[13.5px] leading-[19.5px] text-body">
                  {message.content}
                </Text>
              </View>
            )
          )}
          {isTyping && (
            <View
              className="self-start rounded-[18px] rounded-bl-[4px] bg-white px-3.5 py-[11px]"
              style={CHEF_BUBBLE_SHADOW}>
              <Text className="font-sans text-[13.5px] italic leading-[19.5px] text-muted">
                Şef yazıyor...
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
