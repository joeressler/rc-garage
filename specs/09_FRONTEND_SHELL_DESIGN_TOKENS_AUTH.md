# Milestone 09: Frontend SPA Setup, Industrial Pit-Mat Design System & Zustand Auth

## 1. Objective
Scaffold the React 18 + Vite SPA, configure TailwindCSS with the "Industrial Garage Pit-Mat" design token system, establish layout primitives (workbench header, toolbox drawer tabs), implement the decentralized `useAuthStore` with JWT session persistence, and ship the unauthenticated QR inspection route plus 1.5" chassis sticker printer deferred from Milestone 07.

---

## 2. Scope & Target Files
- `/frontend/src/main.tsx`
- `/frontend/src/App.tsx`
- `/frontend/src/index.css`
- `/frontend/tailwind.config.js`
- `/frontend/src/stores/useAuthStore.ts`
- `/frontend/src/components/layout/PitMatAppLayout.tsx`
- `/frontend/src/components/layout/DiagnosticTopBar.tsx`
- `/frontend/src/components/layout/ToolboxDrawerNavigation.tsx`
- `/frontend/src/components/auth/AuthModal.tsx`
- `/frontend/src/views/PublicInspectionView.tsx`
- `/frontend/src/components/qr/ChassisStickerPrinter.tsx`

---

## 3. Detailed Technical Requirements

### 3.1 TailwindCSS Pit-Mat Design Tokens (`frontend/tailwind.config.js`)
Extend the default Tailwind theme with custom tokens:
```javascript
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'pit-black': '#0E1012',
        'pit-grease': '#16191D',
        'pit-steel': '#21262D',
        'pit-rubber': '#2A313A',
        'hazard-orange': '#FF5500',
        'hazard-stripe': '#E04800',
        'neon-radio': '#00FF66',
        'nitromethane': '#FFB800',
        'anodized-blue': '#00B4D8',
        'metal-border': '#3D444E',
        'metal-highlight': '#6B7280',
        'readout-bright': '#F9FAFB',
        'readout-dim': '#9CA3AF',
        'readout-muted': '#6B7280',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Share Tech Mono"', 'monospace'],
        display: ['"Barlow Condensed"', '"Chakra Petch"', 'sans-serif'],
        sans: ['"Inter"', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'beveled-panel': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 4px 12px rgba(0, 0, 0, 0.5)',
        'neon-glow': '0 0 10px rgba(0, 255, 102, 0.4)',
        'hazard-glow': '0 0 12px rgba(255, 85, 0, 0.5)',
      },
    },
  },
  plugins: [],
};
```

### 3.2 Zustand Auth Store (`frontend/src/stores/useAuthStore.ts`)
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  callsign: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; callsign: string }) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setUser: (user) => set({ user }),
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiLogin(credentials);
          set({ token: res.token, user: res.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },
      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiRegister(payload);
          set({ token: res.token, user: res.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      checkSession: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const user = await apiGetMe();
          set({ user, isAuthenticated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'rc-garage-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
```

### 3.3 Layout Components
1. **`PitMatAppLayout`:** Master container with deep oil-stained background (`bg-pit-black`), grid texture overlay, and responsive container wrapping.
2. **`DiagnosticTopBar`:** Brushed metal header bar featuring driver callsign stencil badge, online telemetry beacon (pulsing `neon-radio` dot), and fleet chassis counter.
3. **`ToolboxDrawerNavigation`:** Tab navigation styled like pull-out aluminum drawers:
   - Drawer 1: Fleet Garage
   - Drawer 2: Setup Clipboard
   - Drawer 3: Community Feed
   - Drawer 4: QR Pit-Stickers

### 3.4 Public Static Chassis Inspection Route (`/s/:slug`)
- Register `/s/:slug` in `App.tsx` **outside** `PitMatAppLayout` so pit-side scans work without authentication.
- `PublicInspectionView` loads instantly from `GET /api/garage/qr/resolve/:slug` (Milestone 07).
- Displays an ultra-clean, mobile-first pit-mat inspection card:
  - Vehicle Make, Model, Class badge.
  - Calculated FDR and battery cell count.
  - Shock oil CST/WT ratings and tire compound tags.
  - Scrutineering stamp and verified badge (`verified` from the resolve payload).
  - One-tap CTA: "Fork this setup into your Garage" (opens `AuthModal` when logged out; forks after Milestone 10 garage selection exists).
- Unknown or private slugs render a pit-mat 404 card (do not leak private sheets).

### 3.5 Physical Chassis Sticker Print Template
- `ChassisStickerPrinter` is the pre-composed 1.5" x 1.5" sticker:
  - High-contrast black QR matrix on white background, loaded from `GET /api/garage/setups/:id/qr?format=svg`.
  - Header: Chassis name (e.g. "VS4-10 Phoenix").
  - Footer: Calculated FDR ("FDR: 10.80:1") and short URL slug.
  - Print CSS (`@media print`) disabling margins and toolbars.
- Milestone 12 wraps this component in `QrPitStickerPrinterModal` for download (SVG / 300 DPI PNG) and direct print. Do not duplicate the sticker layout there.

---

## 4. Verification & Acceptance Criteria
1. Application compiles and renders with Vite HMR without warnings.
2. The UI matches the gritty dark-mode industrial garage theme using defined design tokens.
3. Logging in persists JWT token to local storage and updates `isAuthenticated` across reloads.
4. Logging out wipes token and resets state immediately.
5. Accessing `/s/:slug` on mobile (unauthenticated) renders a complete mechanical inspection sheet from the QR resolve API in under 1 second.
