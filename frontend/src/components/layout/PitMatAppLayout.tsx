import { Outlet } from 'react-router-dom';
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
    </div>
  );
}
