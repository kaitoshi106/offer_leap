import { cn } from '@/lib/cn';

import { VisuallyHidden } from '../../atoms';

export interface BarChartDatum {
  /** Shown under the bar (e.g. "20/10"). */
  label: string;
  value: number;
  /** Part of `value` drawn in the danger colour (e.g. failed calls). */
  highlight?: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** Accessible name of the chart. */
  title: string;
  /** One-sentence summary read instead of the bars (e.g. "120 calls in 30 days, peak 14 on 20/10"). */
  summary: string;
  /** Column headers of the hidden data table: [label, value, highlight]. */
  columns: [string, string, string?];
  className?: string;
}

/**
 * @description Small vertical bar chart drawn with CSS, no chart library. Screen readers get the summary and a
 * visually hidden table with every value; the bars themselves are decoration. Labels thin out on dense charts.
 * @param props - {@link BarChartProps}
 */
export function BarChart({ data, title, summary, columns, className }: BarChartProps) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  // Show at most ~10 labels so they never overlap.
  const labelEvery = Math.ceil(data.length / 10);

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div role="img" aria-label={`${title}. ${summary}`} className="flex h-40 items-end gap-1">
        {data.map((datum) => (
          <div
            key={datum.label}
            title={`${datum.label}: ${datum.value}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div
              className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm bg-primary/80 transition-[height] duration-500"
              style={{ height: `${(datum.value / max) * 100}%` }}
            >
              {Boolean(datum.highlight) && (
                <div
                  className="w-full bg-danger"
                  style={{ height: `${(datum.highlight! / datum.value) * 100}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-1 text-[10px] text-fg-muted">
        {data.map((datum, index) => (
          <span key={datum.label} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {index % labelEvery === 0 ? datum.label : ''}
          </span>
        ))}
      </div>
      <figcaption className="text-xs text-fg-muted">{summary}</figcaption>
      <VisuallyHidden>
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              {columns.filter(Boolean).map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.label}>
                <th scope="row">{datum.label}</th>
                <td>{datum.value}</td>
                {columns[2] && <td>{datum.highlight ?? 0}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </figure>
  );
}
