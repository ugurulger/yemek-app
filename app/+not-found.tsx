import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View className="flex-1 items-center justify-center bg-stone-50 px-8">
        <Text className="text-lg text-stone-900" style={{ fontFamily: 'Fraunces_600SemiBold' }}>
          {t('notFound.body')}
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-sm text-emerald-900" style={{ fontFamily: 'Outfit_500Medium' }}>
            {t('notFound.goHome')}
          </Text>
        </Link>
      </View>
    </>
  );
}
