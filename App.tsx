import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, CrosshairMode, IChartApi } from 'lightweight-charts';
import { useTradingStore } from './store';
import { TrendingUp, AlertTriangle, Star, Settings } from 'lucide-react';

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT'];

interface Signal {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  rationale: string;
  targetPrice: number;
  stopLoss: number;
  positionSizePct?: number;
}

const App = () => {
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [chartContainer, setChartContainer] = useState<HTMLDivElement | null>(null);

  const {
    selectedPair, setSelectedPair,
    futureHorizon, setFutureHorizon,
    preferredEngine, setPreferredEngine,
    favorites, toggleFavorite
  } = useTradingStore();

  const [apiKey, setApiKey] = useState('');
  const [riskPercent, setRiskPercent] = useState(1.0);

  const { data: candles = [] } = useQuery({
    queryKey: ['candles', selectedPair],
    queryFn: async () => {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedPair}&interval=5m&limit=200`);
      const data = await res.json();
      return data.map((k: any) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    },
    refetchInterval: 30000,
  });

  const { data: signal, isLoading: signalLoading, refetch: generateSignal } = useQuery({
    queryKey: ['signal', selectedPair, futureHorizon, preferredEngine],
    queryFn: async () => {
      const prompt = `You are QUOTAX, a professional futures trading advisor. Analyze current market for ${selectedPair} on 5m chart for next ${futureHorizon} minutes.

Current price: ${candles[candles.length-1]?.close || '?'}

Provide high-conviction signal. Consider technicals, momentum, and market regime.
Return ONLY valid JSON.`;

      const res = await fetch('/api/generate-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, apiKey, engine: preferredEngine })
      });

      if (!res.ok) throw new Error('API Error');
      return res.json() as Promise<Signal>;
    },
    enabled: !!candles.length,
    refetchInterval: 45000,
  });

  // Chart setup
  useEffect(() => {
    if (!chartContainer || !candles.length) return;

    const c = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: 420,
      layout: { background: { color: '#0a0e17' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const candleSeries = c.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444'
    });
    candleSeries.setData(candles);

    setChart(c);

    return () => c.remove();
  }, [candles, chartContainer]);

  const positionSize = signal ? (riskPercent / ((Math.abs(signal.targetPrice - signal.stopLoss) / signal.targetPrice) * 100)).toFixed(2) : '0';

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">QUOTAX ADVISOR</h1>
            <p className="text-emerald-400">Professional Futures Intelligence • Binance + Quotex</p>
          </div>
          <div className="flex gap-3">
            <select 
              value={preferredEngine} 
              onChange={(e) => setPreferredEngine(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm"
            >
              <option value="GEMINI">Gemini 1.5 Flash</option>
              <option value="OPENROUTER">OpenRouter (Claude - Aggressive)</option>
              <option value="FALLBACK">Technical Fallback</option>
            </select>
          </div>
        </div>

        {/* Pair Selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {PAIRS.map(pair => (
            <button
              key={pair}
              onClick={() => setSelectedPair(pair)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${selectedPair === pair ? 'bg-emerald-600 text-white' : 'bg-zinc-900 hover:bg-zinc-800'}`}
            >
              {pair}
              <Star 
                className={`w-4 h-4 ${favorites.includes(pair) ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-500'}`} 
                onClick={(e) => { e.stopPropagation(); toggleFavorite(pair); }}
              />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart */}
          <div className="lg:col-span-8 bg-zinc-950 rounded-3xl p-4 border border-zinc-800">
            <div ref={setChartContainer} className="w-full" />
          </div>

          {/* Signal Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800">
              <div className="flex justify-between mb-6">
                <div>
                  <div className="text-sm text-zinc-400">CURRENT SIGNAL</div>
                  <div className="text-6xl font-bold mt-2" style={{ color: signal?.signal === 'BUY' ? '#22c55e' : signal?.signal === 'SELL' ? '#ef4444' : '#64748b' }}>
                    {signal?.signal || '—'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-semibold text-emerald-400">{(signal?.confidence || 0) * 100}%</div>
                  <div className="text-xs text-zinc-500">CONFIDENCE</div>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="p-4 bg-zinc-950 rounded-2xl">
                  {signal?.rationale}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950 p-4 rounded-2xl">
                    <div className="text-xs text-zinc-500">TARGET</div>
                    <div className="text-2xl font-mono text-emerald-400">${signal?.targetPrice?.toFixed(2)}</div>
                  </div>
                  <div className="bg-zinc-950 p-4 rounded-2xl">
                    <div className="text-xs text-zinc-500">STOP LOSS</div>
                    <div className="text-2xl font-mono text-red-400">${signal?.stopLoss?.toFixed(2)}</div>
                  </div>
                </div>

                <div className="bg-amber-950/50 border border-amber-500/30 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Risk Suggestion</span>
                  </div>
                  <div>Position size: <span className="font-mono font-bold">{positionSize}%</span> of capital</div>
                  <input 
                    type="range" 
                    min="0.5" max="3" step="0.1" 
                    value={riskPercent} 
                    onChange={(e) => setRiskPercent(parseFloat(e.target.value))} 
                    className="w-full mt-3 accent-emerald-500"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => generateSignal()}
              disabled={signalLoading}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl font-semibold text-lg active:scale-[0.985]"
            >
              {signalLoading ? 'ANALYZING MARKET...' : 'REFRESH SIGNAL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
