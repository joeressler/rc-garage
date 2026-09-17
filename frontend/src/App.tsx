import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthModal } from './components/auth/AuthModal';
import { PitMatAppLayout } from './components/layout/PitMatAppLayout';
import { useAuthStore } from './stores/useAuthStore';
import { useGarageStore } from './stores/useGarageStore';
import { SetupClipboardView } from './views/SetupClipboardView';
import { CommunityFeedWorkbench } from './views/CommunityFeedWorkbench';
import { GarageFleetView } from './views/GarageFleetView';
import { PublicInspectionView } from './views/PublicInspectionView';
import { StickersWorkbenchView } from './views/StickersWorkbenchView';

/**
 * Purpose: register pit-mat workbench drawers and the unauthenticated chassis inspection route.
 */
export function App() {
  const checkSession = useAuthStore((state) => state.checkSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchVehicles = useGarageStore((state) => state.fetchVehicles);
  const resetGarage = useGarageStore((state) => state.reset);
  const [authOpen, setAuthOpen] = useState(false);
  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchVehicles();
      return;
    }
    resetGarage();
  }, [isAuthenticated, fetchVehicles, resetGarage]);

  return (
    <>
      <Routes>
        <Route
          path="/s/:slug"
          element={<PublicInspectionView onRequestAuth={openAuth} />}
        />
        <Route element={<PitMatAppLayout onRequestAuth={openAuth} />}>
          <Route path="/" element={<Navigate to="/garage" replace />} />
          <Route path="/garage" element={<GarageFleetView onRequestAuth={openAuth} />} />
          <Route path="/clipboard" element={<SetupClipboardView onRequestAuth={openAuth} />} />
          <Route path="/feed" element={<CommunityFeedWorkbench onRequestAuth={openAuth} />} />
          <Route path="/stickers" element={<StickersWorkbenchView onRequestAuth={openAuth} />} />
          <Route path="*" element={<Navigate to="/garage" replace />} />
        </Route>
      </Routes>
      <AuthModal open={authOpen} onClose={closeAuth} />
    </>
  );
}
