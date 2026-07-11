import { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Üstteki 40×5 sürükleme çubuğu (referans sheet'lerinin hepsinde var). */
  showHandle?: boolean;
}

/**
 * Ortak bottom sheet — referans sheet iskeleti birebir: rgba(20,30,25,.4)
 * karartma, krem (#F7F5F0) gövde, üst radius 28, padding 10/20/34, üstte
 * 40×5 kum rengi tutamaç. Karartmaya dokununca kapanır; içerik dokunuşları
 * kapanmayı tetiklemez.
 */
export function BottomSheet({ visible, onClose, children, showHandle = true }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Kapat"
        onPress={onClose}
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(20,30,25,0.4)' }}>
        {/* İç Pressable: dokunuşu yutar, karartmanın onPress'ine ulaşmaz. */}
        <Pressable
          onPress={() => {}}
          className="rounded-t-[28px] bg-cream px-5 pb-[34px] pt-2.5">
          {showHandle && (
            <View className="mb-4 h-[5px] w-10 self-center rounded-[20px] bg-[#D6D2C8]" />
          )}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
