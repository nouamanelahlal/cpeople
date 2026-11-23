import type { JSX } from 'react';

/**
 * Marks a panel that is a picture of a module not built yet (HR-01 spec 6.12).
 *
 * The payroll month, the cost chart, who is away and the connections are drawn
 * from sample figures so the screen reads whole. Saying so on the panel is the
 * difference between a preview and a claim.
 */
export function PreviewTag({ label, title }: { label: string; title: string }): JSX.Element {
  return (
    <span
      title={title}
      className="rounded-full border border-card-border bg-white/70 px-2.5 py-1 text-xs font-semibold text-body"
    >
      {label}
    </span>
  );
}
