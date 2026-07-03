import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-stone-50 px-8">
        <Text className="text-lg text-stone-900" style={{ fontFamily: 'Fraunces_600SemiBold' }}>
          Bu sayfa bulunamadı.
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-sm text-emerald-900" style={{ fontFamily: 'Outfit_500Medium' }}>
            Ana sayfaya dön
          </Text>
        </Link>
      </View>
    </>
  );
}
