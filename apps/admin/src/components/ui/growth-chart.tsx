'use client';

import { useState } from 'react';

export interface GrowthChartPoint {
  weekStart: string;
  count: number;
}

export interface GrowthChartProps {
  title: string;
  subtitle: string;
  data: GrowthChartPoint[];
}

const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

function weekLabel(weekStart: string): string {
  return WEEK_LABEL_FORMATTER.format(new Date(`${weekStart}T00:00:00Z`));
}

/** Eixo Y em número redondo (1/2/5 × potência de 10), nunca o valor bruto. */
function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const normalized = rawMax / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Gráfico de barras de série única (sem legenda — só uma cor, o título já
 * diz o que é), semanas mais antigas à esquerda. Usa só --color-primary,
 * já que a cor aqui não carrega identidade (não há mais de uma série por
 * gráfico) — ver skill de dataviz.
 */
export function GrowthChart({ title, subtitle, data }: GrowthChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const rawMax = Math.max(...data.map((point) => point.count), 0);
  const axisMax = niceMax(rawMax);
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const lastIndex = data.length - 1;
  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-bold text-text">{title}</h3>
          <p className="text-xs text-text-secondary">{subtitle}</p>
        </div>
        <p className="text-right font-heading text-lg font-bold text-text">
          {hovered ? hovered.count : total}
          <span className="ml-1 text-xs font-normal text-text-secondary">
            {hovered ? weekLabel(hovered.weekStart) : 'total no período'}
          </span>
        </p>
      </div>

      <div className="mt-5 flex h-32 items-end gap-1.5 border-b border-border pt-5">
        {data.map((point, index) => {
          const heightPct = axisMax === 0 ? 0 : (point.count / axisMax) * 100;
          const isHovered = hoveredIndex === index;
          const isLast = index === lastIndex;

          return (
            <button
              key={point.weekStart}
              type="button"
              aria-label={`semana de ${weekLabel(point.weekStart)}: ${point.count}`}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
            >
              {isHovered && (
                <div className="absolute -top-8 z-10 whitespace-nowrap rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-background shadow-md">
                  {point.count}
                  <span className="ml-1 font-normal text-background/70">{weekLabel(point.weekStart)}</span>
                </div>
              )}
              {isLast && !isHovered && point.count > 0 && (
                <span className="absolute -top-5 text-xs font-semibold text-text">{point.count}</span>
              )}
              <div
                className={`w-full max-w-[24px] rounded-t-[4px] transition-colors ${
                  isHovered ? 'bg-accent' : 'bg-primary'
                }`}
                style={{
                  height: `${heightPct}%`,
                  minHeight: point.count > 0 ? '3px' : '0px',
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((point, index) => (
          <div key={point.weekStart} className="flex-1 text-center text-[11px] text-text-secondary">
            {index === 0 || index === lastIndex ? weekLabel(point.weekStart) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
