import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthModal } from './components/auth/AuthModal';
import { PitMatAppLayout } from './components/layout/PitMatAppLayout';
import { useAuthStore } from './stores/useAuthStore';
import { ClipboardPlaceholderView } from './views/ClipboardPlaceholderView';
import { FeedPlaceholderView } from './views/FeedPlaceholderView';
import { GaragePlaceholderView } from './views/GaragePlaceholderView';
import { PublicInspectionView } from './views/PublicInspectionView';
import { StickersPlaceholderView } from './views/StickersPlaceholderView';

/**
 * Purpose: register pit-mat workbench drawers and the unauthenticated chassis inspection route.
 */
export function App() {
  const checkSession = useAuthStore((state) => state.checkSession);
  const [authOpen, setAuthOpen] = useState(false);
  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  return (
    <>
      <Routes>
        <Route
          path="/s/:slug"
          element={<PublicInspectionView onRequestAuth={openAuth} />}
        />
        <Route element={<PitMatAppLayout onRequestAuth={openAuth} />}>
          <Route path="/" element={<Navigate to="/garage" replace />} />
          <Route path="/garage" element={<GaragePlaceholderView />} />
          <Route path="/clipboard" element={<ClipboardPlaceholderView />} />
          <Route path="/feed" element={<FeedPlaceholderView />} />
          <Route path="/stickers" element={<StickersPlaceholderView />} />
          <Route path="*" element={<Navigate to="/garage" replace />} />
        </Route>
      </Routes>
      <AuthModal open={authOpen} onClose={closeAuth} />
    </>
  );
}
