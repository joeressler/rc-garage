import { Link, Outlet } from 'react-router-dom';
import { DiagnosticTopBar } from './DiagnosticTopBar';
import { ToolboxDrawerNavigation } from './ToolboxDrawerNavigation';

interface PitMatAppLayoutProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: wrap authenticated workbench routes in the industrial pit-mat chrome.
 */
export function PitMatAppLayout({ onRequestAuth }: PitMatAppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col pit-mat-grid">
      <DiagnosticTopBar onRequestAuth={onRequestAuth} />
      <ToolboxDrawerNavigation />
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-metal-border px-4 py-3">
        <nav className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
          <Link className="hover:text-hazard-orange" to="/legal/terms">
            Terms
          </Link>
          <Link className="hover:text-hazard-orange" to="/legal/privacy">
            Privacy
          </Link>
          <Link className="hover:text-hazard-orange" to="/legal/guidelines">
            Community Guidelines
          </Link>
        </nav>
      </footer>
    </div>
  );
}
