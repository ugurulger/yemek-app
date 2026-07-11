import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors, fonts } from '../../lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          // Referans BOTTOM NAV: rgba(247,245,240,.92) KREM zemin +
          // border-top 1px rgba(31,74,61,.08). (Blur'suz yaklaşım —
          // expo-blur eklemeden; renk değerleri birebir kaynaktan.)
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
        },
        // Referans: label 600 10px Hanken Grotesk, ikon 23px, gap 5.
        tabBarLabelStyle: {
          fontFamily: fonts.sansSemibold,
          fontSize: 10,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mutfağım',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'basket' : 'basket-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Tarifler',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={23} color={color} />
          ),
        }}
      />
      {/* Referans BOTTOM NAV sırası: Mutfağım · Tarifler · Kayıtlı · Plan · Market. */}
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Kayıtlı',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
