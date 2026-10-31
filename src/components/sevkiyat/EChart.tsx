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
        palette: ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#a3e635', '#f472b6', '#94a3b8', '#2dd4bf'],
        text: '#e2e8f0',
        muted: '#8fa3bd',
        axis: '#33415c',
        split: 'rgba(148,163,184,.12)',
        tooltipBg: 'rgba(10,16,30,.95)',
        tooltipBorder: 'rgba(56,189,248,.35)',
        cardBg: 'rgba(56,189,248,.06)',
        gridDim: 'rgba(148,163,184,.15)',
        pos: '#34d399',
        neg: '#f87171',
      }
    : {
        palette: ['#0284c7', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#db2777', '#475569', '#0d9488'],
        text: '#0f172a',
        muted: '#64748b',
        axis: '#cbd5e1',
        split: 'rgba(100,116,139,.14)',
        tooltipBg: 'rgba(15,23,42,.94)',
        tooltipBorder: 'rgba(2,132,199,.35)',
        cardBg: 'rgba(2,132,199,.05)',
        gridDim: 'rgba(100,116,139,.15)',
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
