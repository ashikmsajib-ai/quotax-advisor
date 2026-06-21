import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TradingState {
  selectedPair: string;
  futureHorizon: number;
  preferredEngine: 'GEMINI' | 'OPENROUTER' | 'FALLBACK';
  favorites: string[];
  setSelectedPair: (pair: string) => void;
  setFutureHorizon: (h: number) => void;
  setPreferredEngine: (e: 'GEMINI' | 'OPENROUTER' | 'FALLBACK') => void;
  toggleFavorite: (pair: string) => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set) => ({
      selectedPair: 'BTCUSDT',
      futureHorizon: 5,
      preferredEngine: 'OPENROUTER',
      favorites: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      setSelectedPair: (pair) => set({ selectedPair: pair }),
      setFutureHorizon: (h) => set({ futureHorizon: h }),
      setPreferredEngine: (e) => set({ preferredEngine: e }),
      toggleFavorite: (pair) => set((state) => ({
        favorites: state.favorites.includes(pair)
          ? state.favorites.filter(p => p !== pair)
          : [...state.favorites, pair]
      })),
    }),
    { name: 'quotax-advisor-storage' }
  )
);
