import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

export interface WebImportScreenProps {
  visible: boolean;
  onClose: () => void;
  /** 'Örnek: Menemen tarifini aç' → web örnek tarifinin import'u. */
  onImport: () => void;
}

/** Google logo harf renkleri — referans 736. */
const GOOGLE_LETTERS: { letter: string; color: string }[] = [
  { letter: 'G', color: '#4285F4' },
  { letter: 'o', color: '#EA4335' },
  { letter: 'o', color: '#FBBC05' },
  { letter: 'g', color: '#4285F4' },
  { letter: 'l', color: '#34A853' },
  { letter: 'e', color: '#EA4335' },
];

/**
 * Web tarayıcı taklidi — referans WEB IMPORT browser mimic (Mutfagim.dc.html
 * 719-750): adres pili + mavi Mutfağım bandı + Google arama gövdesi + alt
 * gezinme barı. 'Örnek: Menemen tarifini aç' menemeni içe aktarır.
 */
export function WebImportScreen({ visible, onClose, onImport }: WebImportScreenProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View style={{ height: 44 }} />

        {/* Üst satır: kapat + adres pili + yenile — referans 722-729. */}
        <View
          className="flex-row items-center"
          style={{ gap: 12, paddingVertical: 8, paddingHorizontal: 16 }}>
          <Pressable onPress={onClose} hitSlop={8} className="active:opacity-70">
            <Ionicons name="close" size={22} color="#23302B" />
          </Pressable>
          <View
            className="flex-1 items-center"
            style={{
              backgroundColor: '#EFEEEC',
              borderRadius: 12,
              paddingVertical: 9,
              paddingHorizontal: 14,
            }}>
            <Text className="font-sans-medium text-[14px]" style={{ color: '#7B7F86' }}>
              Menemen
            </Text>
          </View>
          <Ionicons name="refresh" size={20} color="#23302B" />
        </View>

        {/* Mavi Mutfağım bandı — referans 730-733. */}
        <View
          className="flex-row items-center justify-center"
          style={{ backgroundColor: '#4C8DF6', padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 19 }}>🍳</Text>
          <Text
            className="font-sans-semibold text-white"
            style={{ fontSize: 20, fontStyle: 'italic' }}>
            Mutfağım
          </Text>
        </View>

        {/* Gövde: Google başlığı + arama kutusu + örnek tarif butonu — referans 734-744. */}
        <View className="flex-1 items-center" style={{ backgroundColor: '#F3EEDF', paddingTop: 80 }}>
          <View className="flex-row" style={{ marginBottom: 26 }}>
            {GOOGLE_LETTERS.map((item, index) => (
              <Text key={index} className="font-serif" style={{ fontSize: 34, color: item.color }}>
                {item.letter}
              </Text>
            ))}
            <Text className="font-serif text-ink" style={{ fontSize: 34 }}>
              {' '}
              ile tarif ara
            </Text>
          </View>
          <View
            className="flex-row items-center bg-white"
            style={{
              width: '82%',
              borderWidth: 1,
              borderColor: '#E3E0DA',
              borderRadius: 26,
              paddingVertical: 14,
              paddingHorizontal: 18,
              gap: 12,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}>
            <Ionicons name="search" size={18} color="#9AA0A6" />
            <Text className="font-sans text-[16px] text-ink">Menemen</Text>
          </View>
          <Pressable
            onPress={onImport}
            className="items-center rounded-[14px] bg-forest active:scale-[0.98]"
            style={{
              marginTop: 26,
              paddingVertical: 13,
              paddingHorizontal: 22,
              shadowColor: '#1F4A3D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4,
            }}>
            <Text className="font-sans-semibold text-[14px] text-white">
              Örnek: Menemen tarifini aç
            </Text>
          </Pressable>
        </View>

        {/* Alt bar: yönlendirme metni + geri/ileri okları — referans 745-750. */}
        <View
          className="items-center bg-white"
          style={{
            borderTopWidth: 1,
            borderTopColor: '#EDECEA',
            paddingTop: 14,
            paddingHorizontal: 16,
            paddingBottom: 26,
          }}>
          <Text className="font-sans-semibold text-[15px] text-ink" style={{ marginBottom: 12 }}>
            İçe aktarmak için bir tarif aç
          </Text>
          <View className="flex-row justify-center" style={{ gap: 60 }}>
            <Ionicons name="chevron-back" size={22} color="#C7CFC9" />
            <Ionicons name="chevron-forward" size={22} color="#4C8DF6" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
