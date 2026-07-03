import { create } from 'zustand';

import type { Recipe } from '@/types/recipe';

interface RecipeState {
  recipes: Recipe[];
  setRecipes: (recipes: Recipe[]) => void;
  getRecipeById: (id: string) => Recipe | undefined;
}

export const useRecipeStore = create<RecipeState>()((set, get) => ({
  recipes: [],
  setRecipes: (recipes) => set({ recipes }),
  getRecipeById: (id) => get().recipes.find((recipe) => recipe.id === id),
}));
