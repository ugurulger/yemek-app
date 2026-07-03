export type InventoryUnit = 'adet' | 'g' | 'kg' | 'ml' | 'l' | 'demet';

export type InventoryConfidence = 'high' | 'low';

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  unit: InventoryUnit;
  emoji: string;
  confidence?: InventoryConfidence;
}
