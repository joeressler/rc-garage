import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

interface DrawerItem {
  to: string;
  label: string;
  index: string;
}

const BASE_DRAWERS: DrawerItem[] = [
  { to: '/garage', label: 'Fleet Garage', index: '01' },
  { to: '/clipboard', label: 'Setup Clipboard', index: '02' },
  { to: '/feed', label: 'Community Feed', index: '03' },
  { to: '/stickers', label: 'QR Pit-Stickers', index: '04' },
];

/**
 * Purpose: present toolbox-drawer navigation for the pit-mat workbenches, revealing the Scrutineering Desk for staff.
 */
export function ToolboxDrawerNavigation() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const isElevated = user?.role === 'admin' || user?.role === 'moderator';
  const inspectingPublicSlug = location.pathname.startsWith('/s/');

  const drawers: DrawerItem[] = [
    ...BASE_DRAWERS,
    ...(isElevated
      ? [{ to: '/admin', label: 'Scrutineering Desk', index: '05' }]
      : []),
  ];

  return (
    <nav
      aria-label="Toolbox drawers"
      className="border-b border-metal-border bg-pit-grease/90 px-3 py-2 sm:px-5"
    >
      <ul className="flex gap-2 overflow-x-auto">
        {drawers.map((drawer) => (
          <li key={drawer.to} className="shrink-0">
            <NavLink
              to={drawer.to}
              className={({ isActive }) => {
                const drawerActive =
                  isActive || (drawer.to === '/feed' && inspectingPublicSlug);
                return [
                  'flex min-w-[9.5rem] items-center gap-2 border-t-2 border-l-2 px-3 py-2 font-display text-sm uppercase tracking-[0.18em] shadow-beveled-panel transition',
                  drawerActive
                    ? 'border-hazard-orange bg-pit-steel text-hazard-orange'
                    : 'border-pit-rubber bg-pit-black/60 text-readout-dim hover:border-metal-highlight hover:text-readout-bright',
                ].join(' ');
              }}
            >
              <span className="font-mono text-[10px] text-readout-muted">
                {drawer.index}
              </span>
              {drawer.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
