/**
 * Faz 2 mock servisleri — frontend agent'ları gerçek backend hazır olana
 * kadar BUNLARI kullanır; entegrasyonda (Faz 3) import'lar lib/claude
 * altındaki gerçek implementasyonlarla değiştirilir. İmzalar
 * services/contracts.ts ile birebir aynıdır. (Skill kuralı: mock veri
 * yalnızca __mocks__/ altında yaşar.)
 */
import type { AskChef, ParseIngredients } from '@/services/contracts';
import type { InventoryItem } from '@/types/inventory';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockParseIngredients: ParseIngredients = async (text) => {
  await delay(900);
  return text
    .split(/[,;\n]| ve /gi)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index): InventoryItem => {
      const qtyMatch = part.match(/^(\d+)\s+(.*)$/);
      return {
        id: `mock-parsed-${Date.now()}-${index}`,
        name: qtyMatch ? qtyMatch[2] : part,
        qty: qtyMatch ? Number(qtyMatch[1]) : 1,
        unit: 'adet',
        emoji: '🧺',
        confidence: 100,
      };
    });
};

export const mockAskChef: AskChef = async (recipe, _history, message) => {
  await delay(1200);
  return (
    `"${recipe.name}" için güzel soru! ("${message}") — Bu bir mock yanıt: ` +
    'entegrasyonda gerçek şef (Claude) bağlanacak. Malzeme değişimi istersen ' +
    'miktarları da güncelleyerek öneririm.'
  );
};
