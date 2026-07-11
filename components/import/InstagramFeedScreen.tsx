import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export interface InstagramFeedScreenProps {
  visible: boolean;
  /** '‹ Mutfağım' geri satırı — akışı tamamen kapatır. */
  onClose: () => void;
  /** Send ikonu veya alt "Mutfağım'a gönder" kartı → örnek tarif import'u. */
  onImport: () => void;
}

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/**
 * Instagram feed taklidi — referans INSTAGRAM FEED mimic (Mutfagim.dc.html
 * 679-717): siyah tam ekran, koyu tema gönderi düzeni; degradeler paket
 * eklememek için düz renklerle yaklaşıklanır (avatar #DD2A7B, foto #E7A15C).
 * Send ikonundaki amber vurgu dairesi ve alttaki beyaz kart import'u tetikler.
 */
export function InstagramFeedScreen({ visible, onClose, onImport }: InstagramFeedScreenProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <View style={{ height: 52 }} />

        {/* Üst satır: geri / For you / kalp — referans 683-687. */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingTop: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={onClose} hitSlop={10} className="active:opacity-70">
            <Text className="font-sans-semibold text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
              ‹ Mutfağım
            </Text>
          </Pressable>
          <Text className="font-sans-semibold text-[18px] text-white">For you ⌄</Text>
          <Ionicons name="heart-outline" size={22} color="#FFFFFF" />
        </View>

        {/* Kullanıcı satırı — referans 688-694. */}
        <View
          className="flex-row items-center"
          style={{ gap: 11, paddingVertical: 8, paddingHorizontal: 14 }}>
          <View
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#DD2A7B' }}
          />
          <View className="flex-1">
            <Text className="font-sans-semibold text-[13px] text-white">madeleinesmeals ✓</Text>
            <Text className="font-sans text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Liverpool
            </Text>
          </View>
        </View>

        {/* Foto alanı — 330px turuncu zemin + mono etiket (referans 695-697). */}
        <View
          className="items-center justify-center"
          style={{ height: 330, backgroundColor: '#E7A15C' }}>
          <Text
            style={{
              fontFamily: MONO_FONT,
              fontSize: 11,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.5)',
            }}>
            somon bowl · 1/2
          </Text>
        </View>

        {/* Aksiyon satırı: kalp / yorum / send (vurgulu) / bookmark — referans 698-707. */}
        <View
          className="flex-row items-center"
          style={{ gap: 20, paddingVertical: 12, paddingHorizontal: 16 }}>
          <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
          <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
          <Pressable onPress={onImport} accessibilityLabel="Mutfağım'a gönder" hitSlop={10}>
            {/* -9px taşan amber vurgu dairesi — dikkat çağrısı (referans 702). */}
            <View
              style={{
                position: 'absolute',
                top: -9,
                bottom: -9,
                left: -9,
                right: -9,
                borderRadius: 21,
                backgroundColor: 'rgba(227,138,42,0.35)',
              }}
            />
            <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
          </Pressable>
          <View className="flex-1" />
          <Ionicons name="bookmark-outline" size={22} color="#FFFFFF" />
        </View>

        {/* Alt beyaz kart: Mutfağım'a gönder — referans 708-716. */}
        <Pressable
          onPress={onImport}
          className="flex-row items-center rounded-[18px] bg-white active:scale-[0.98]"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 30,
            paddingVertical: 14,
            paddingHorizontal: 16,
            gap: 12,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          }}>
          <View
            className="items-center justify-center bg-forest"
            style={{ width: 38, height: 38, borderRadius: 11 }}>
            <Text style={{ fontSize: 18 }}>🍳</Text>
          </View>
          <View className="flex-1">
            <Text className="font-sans-semibold text-[13.5px] text-ink">Mutfağım'a gönder</Text>
            <Text className="font-sans text-[11px] text-muted">
              Tarifi içe aktarmak için dokun
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.forest} />
        </Pressable>
      </View>
    </Modal>
  );
}
