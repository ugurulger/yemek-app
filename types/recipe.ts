export interface RecipeMacros {
  protein: number;
  karb: number;
  yag: number;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  kcal: number;
  servings: number;
  time_min: number;
  macros: RecipeMacros;
  match_pct: number;
  ingredients: string[];
  steps: string[];
}
