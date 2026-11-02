'use client';

/* ECharts React sarmalayıcı — çift tema (açık/koyu), otomatik yeniden boyutlandırma */
import * as echarts from 'echarts';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useTheme } from 'next-themes';
export interface ChartColors {
  palette: string[];
  text: string;
  muted: string;
  axis: string;
  split: string;
  tooltipBg: string;
  tooltipBorder: string;
  cardBg: string;
  gridDim: string;
  pos: string;
  neg: string;
}

export function chartColors(dark: boolean): ChartColors {
  return dark
    ? {
        palette: ['#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#22d3ee', '#f87171', '#a3e635', '#fb923c', '#2dd4bf', '#c084fc', '#facc15', '#fb7185'],
        text: '#e2e8f0',
        muted: '#8fa3bd',
        axis: '#3b3462',
        split: 'rgba(167,139,250,.12)',
        tooltipBg: 'rgba(20,14,40,.95)',
        tooltipBorder: 'rgba(167,139,250,.4)',
        cardBg: 'rgba(167,139,250,.07)',
        gridDim: 'rgba(167,139,250,.15)',
        pos: '#34d399',
        neg: '#f87171',
      }
    : {
        palette: ['#7c3aed', '#f59e0b', '#10b981', '#ec4899', '#0891b2', '#ef4444', '#84cc16', '#f97316', '#0d9488', '#a855f7', '#ca8a04', '#f43f5e'],
        text: '#1e1b2e',
        muted: '#6b6485',
        axis: '#ddd6f3',
        split: 'rgba(124,58,237,.12)',
        tooltipBg: 'rgba(30,20,55,.94)',
        tooltipBorder: 'rgba(124,58,237,.35)',
        cardBg: 'rgba(124,58,237,.05)',
        gridDim: 'rgba(124,58,237,.15)',
        pos: '#059669',
        neg: '#dc2626',
      };
}

/** Tema duyarlı temel seçenek üretici */
export function baseChart(dark: boolean) {
  const c = chartColors(dark);
  return {
    c,
    textStyle: { fontFamily: 'var(--font-geist-sans, Inter), system-ui, sans-serif', color: c.text },
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      extraCssText: 'backdrop-filter:blur(6px);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);',
      confine: true,
    },
    axisCommon: {
      axisLine: { lineStyle: { color: c.axis } },
      axisLabel: { color: c.muted, fontSize: 11 },
      axisTick: { lineStyle: { color: c.axis } },
      splitLine: { lineStyle: { color: c.split } },
      nameTextStyle: { color: c.muted, fontSize: 11 },
    },
  };
}

export interface EChartProps {
  option: echarts.EChartsCoreOption;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  onClickData?: (params: echarts.ECElementEvent) => void;
}

export default function EChart({ option, height = 280, className, style, onClickData }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    if (onClickData) chart.on('click', onClickData);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true });
  }, [option, dark]);

  return <div ref={ref} className={className} style={{ width: '100%', height, ...style }} />;
}
