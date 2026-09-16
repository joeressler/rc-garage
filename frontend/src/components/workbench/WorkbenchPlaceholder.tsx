import type { ReactNode } from 'react';

interface WorkbenchPlaceholderProps {
  drawer: string;
  title: string;
  milestone: string;
  summary: string;
  children?: ReactNode;
}

/**
 * Purpose: reserve toolbox-drawer destinations until later milestone workbenches ship.
 */
export function WorkbenchPlaceholder({
  drawer,
  title,
  milestone,
  summary,
  children,
}: WorkbenchPlaceholderProps) {
  return (
    <section className="relative overflow-hidden border-t-2 border-l-2 border-pit-rubber bg-pit-steel/90 p-6 shadow-beveled-panel">
      <span className="hex-rivet left-3 top-3" />
      <span className="hex-rivet right-3 top-3" />
      <span className="hex-rivet bottom-3 left-3" />
      <span className="hex-rivet bottom-3 right-3" />

      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-nitromethane">
        Drawer {drawer} · {milestone}
      </p>
      <h1 className="mt-2 font-display text-4xl uppercase tracking-wide text-readout-bright">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-readout-dim">{summary}</p>
      {children}
    </section>
  );
}
