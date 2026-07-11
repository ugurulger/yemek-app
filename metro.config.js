const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// zustand v5'in ESM çıktısı (esm/*.mjs) `import.meta` kullanıyor — Metro'nun
// web bundle'ı bunu desteklemediği için tüm client JS SyntaxError ile
// ölüyordu. "import" koşulunu çıkarıp CJS çözümlemesine zorluyoruz (native
// tarafta zaten CJS çözümleniyordu, davranış değişmez).
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = withNativeWind(config, { input: './global.css' });
