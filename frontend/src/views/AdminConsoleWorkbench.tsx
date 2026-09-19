import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { UserRole } from '../api/admin';
import { AdminOverviewPanel } from '../components/admin/AdminOverviewPanel';
import { ModerationAuditLogPanel } from '../components/admin/ModerationAuditLogPanel';
import { ReportQueuePanel } from '../components/admin/ReportQueuePanel';
import { SetupModerationTable } from '../components/admin/SetupModerationTable';
import { UserModerationTable } from '../components/admin/UserModerationTable';
import { useAdminStore } from '../stores/useAdminStore';
import { useAuthStore } from '../stores/useAuthStore';

interface AdminConsoleWorkbenchProps {
  onRequestAuth: () => void;
}

type AdminTab = 'users' | 'setups' | 'audit' | 'reports';

/**
 * Purpose: render the Scrutineering Desk admin console workbench for platform operators.
 */
export function AdminConsoleWorkbench({
  onRequestAuth,
}: AdminConsoleWorkbenchProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const overview = useAdminStore((state) => state.overview);
  const users = useAdminStore((state) => state.users);
  const usersHasMore = useAdminStore((state) => state.usersHasMore);
  const setups = useAdminStore((state) => state.setups);
  const setupsHasMore = useAdminStore((state) => state.setupsHasMore);
  const auditLogs = useAdminStore((state) => state.auditLogs);
  const auditLogsHasMore = useAdminStore((state) => state.auditLogsHasMore);
  const reports = useAdminStore((state) => state.reports);
  const reportsHasMore = useAdminStore((state) => state.reportsHasMore);
  const filters = useAdminStore((state) => state.filters);
  const isLoading = useAdminStore((state) => state.isLoading);
  const isActionLoading = useAdminStore((state) => state.isActionLoading);
  const error = useAdminStore((state) => state.error);
  const actionError = useAdminStore((state) => state.actionError);

  const fetchOverview = useAdminStore((state) => state.fetchOverview);
  const fetchUsers = useAdminStore((state) => state.fetchUsers);
  const fetchSetups = useAdminStore((state) => state.fetchSetups);
  const fetchAuditLog = useAdminStore((state) => state.fetchAuditLog);
  const fetchReports = useAdminStore((state) => state.fetchReports);
  const setFilters = useAdminStore((state) => state.setFilters);
  const suspendUser = useAdminStore((state) => state.suspendUser);
  const changeUserRole = useAdminStore((state) => state.changeUserRole);
  const toggleSetupVisibility = useAdminStore(
    (state) => state.toggleSetupVisibility,
  );
  const deleteSetup = useAdminStore((state) => state.deleteSetup);
  const resolveReport = useAdminStore((state) => state.resolveReport);

  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // Gating check
  const isElevated =
    isAuthenticated && (user?.role === 'admin' || user?.role === 'moderator');

  useEffect(() => {
    if (!isElevated) return;
    void fetchOverview();
  }, [isElevated, fetchOverview]);

  useEffect(() => {
    if (!isElevated) return;
    if (activeTab === 'users') {
      void fetchUsers(true);
    } else if (activeTab === 'setups') {
      void fetchSetups(true);
    } else if (activeTab === 'audit') {
      void fetchAuditLog(true);
    } else if (activeTab === 'reports') {
      void fetchReports(true);
    }
  }, [
    isElevated,
    activeTab,
    filters.userQuery,
    filters.userRole,
    filters.userSuspended,
    filters.setupQuery,
    filters.setupHidden,
    filters.setupPublic,
    filters.reportStatus,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="border border-metal-border bg-pit-grease p-8 text-center shadow-beveled-panel">
        <h2 className="font-display text-xl uppercase tracking-[0.2em] text-hazard-orange">
          Scrutineering Desk (Restricted Access)
        </h2>
        <p className="mt-2 text-sm text-readout-dim">
          Operator privileges required to access the moderation console.
        </p>
        <button
          type="button"
          onClick={onRequestAuth}
          className="mt-4 border border-hazard-orange bg-hazard-orange px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-pit-black hover:bg-hazard-stripe"
        >
          Authenticate Operator
        </button>
      </div>
    );
  }

  if (!isElevated) {
    return <Navigate to="/garage" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-metal-border pb-4">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.2em] text-readout-bright">
            Scrutineering Desk
          </h1>
          <p className="font-mono text-xs text-readout-dim">
            Operator Console — Driver Moderation, Content Review, and Audit
            Ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-readout-muted">
            Operator Callsign:
          </span>
          <span className="font-mono text-xs font-bold text-hazard-orange">
            @{user?.callsign} ({user?.role})
          </span>
        </div>
      </div>

      {error && (
        <div className="border border-hazard-orange bg-hazard-orange/10 p-3 font-mono text-xs text-hazard-orange">
          {error}
        </div>
      )}

      {/* KPI Overview Strip */}
      <AdminOverviewPanel overview={overview} isLoading={isLoading} />

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-metal-border">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`border-b-2 px-4 py-2 font-display text-sm uppercase tracking-wider transition ${
              activeTab === 'users'
                ? 'border-hazard-orange text-hazard-orange font-bold'
                : 'border-transparent text-readout-dim hover:text-readout-bright'
            }`}
          >
            Driver Accounts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setups')}
            className={`border-b-2 px-4 py-2 font-display text-sm uppercase tracking-wider transition ${
              activeTab === 'setups'
                ? 'border-hazard-orange text-hazard-orange font-bold'
                : 'border-transparent text-readout-dim hover:text-readout-bright'
            }`}
          >
            Setup Sheets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`border-b-2 px-4 py-2 font-display text-sm uppercase tracking-wider transition ${
              activeTab === 'audit'
                ? 'border-hazard-orange text-hazard-orange font-bold'
                : 'border-transparent text-readout-dim hover:text-readout-bright'
            }`}
          >
            Audit Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`border-b-2 px-4 py-2 font-display text-sm uppercase tracking-wider transition ${
              activeTab === 'reports'
                ? 'border-hazard-orange text-hazard-orange font-bold'
                : 'border-transparent text-readout-dim hover:text-readout-bright'
            }`}
          >
            Reports
          </button>
        </div>

        {/* Tab Filters */}
        {activeTab === 'users' && (
          <div className="flex flex-wrap items-center gap-2 py-2">
            <input
              type="text"
              placeholder="Search callsign or email..."
              value={filters.userQuery}
              onChange={(e) => setFilters({ userQuery: e.target.value })}
              className="border border-metal-border bg-pit-black px-2.5 py-1 font-mono text-xs text-readout-bright placeholder:text-readout-muted focus:border-hazard-orange focus:outline-none"
            />
            <select
              aria-label="Filter by role"
              value={filters.userRole ?? ''}
              onChange={(e) =>
                setFilters({
                  userRole: (e.target.value as UserRole) || undefined,
                })
              }
              className="border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-dim focus:border-hazard-orange focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="driver">Drivers</option>
              <option value="moderator">Moderators</option>
              <option value="admin">Admins</option>
            </select>
            <select
              aria-label="Filter by suspension status"
              value={
                filters.userSuspended === undefined
                  ? ''
                  : String(filters.userSuspended)
              }
              onChange={(e) =>
                setFilters({
                  userSuspended:
                    e.target.value === ''
                      ? undefined
                      : e.target.value === 'true',
                })
              }
              className="border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-dim focus:border-hazard-orange focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="false">Active Only</option>
              <option value="true">Suspended Only</option>
            </select>
          </div>
        )}

        {activeTab === 'setups' && (
          <div className="flex flex-wrap items-center gap-2 py-2">
            <input
              type="text"
              placeholder="Search title, make, model..."
              value={filters.setupQuery}
              onChange={(e) => setFilters({ setupQuery: e.target.value })}
              className="border border-metal-border bg-pit-black px-2.5 py-1 font-mono text-xs text-readout-bright placeholder:text-readout-muted focus:border-hazard-orange focus:outline-none"
            />
            <select
              aria-label="Filter by visibility"
              value={
                filters.setupHidden === undefined
                  ? ''
                  : String(filters.setupHidden)
              }
              onChange={(e) =>
                setFilters({
                  setupHidden:
                    e.target.value === ''
                      ? undefined
                      : e.target.value === 'true',
                })
              }
              className="border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-dim focus:border-hazard-orange focus:outline-none"
            >
              <option value="">All Content</option>
              <option value="false">Visible Content</option>
              <option value="true">Force-Hidden Only</option>
            </select>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex flex-wrap items-center gap-2 py-2">
            <select
              aria-label="Filter reports by status"
              value={filters.reportStatus}
              onChange={(e) =>
                setFilters({
                  reportStatus: e.target.value as typeof filters.reportStatus,
                })
              }
              className="border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-dim focus:border-hazard-orange focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Tab Views */}
      {activeTab === 'users' && (
        <UserModerationTable
          users={users}
          currentUserRole={user?.role}
          currentUserId={user?.id}
          hasMore={usersHasMore}
          isLoading={isLoading}
          isActionLoading={isActionLoading}
          actionError={actionError}
          onLoadMore={() => fetchUsers(false)}
          onSuspend={suspendUser}
          onChangeRole={changeUserRole}
        />
      )}

      {activeTab === 'setups' && (
        <SetupModerationTable
          setups={setups}
          currentUserRole={user?.role}
          hasMore={setupsHasMore}
          isLoading={isLoading}
          isActionLoading={isActionLoading}
          actionError={actionError}
          onLoadMore={() => fetchSetups(false)}
          onToggleVisibility={toggleSetupVisibility}
          onDeleteSetup={deleteSetup}
        />
      )}

      {activeTab === 'audit' && (
        <ModerationAuditLogPanel
          logs={auditLogs}
          hasMore={auditLogsHasMore}
          isLoading={isLoading}
          onLoadMore={() => fetchAuditLog(false)}
        />
      )}

      {activeTab === 'reports' && (
        <ReportQueuePanel
          reports={reports}
          hasMore={reportsHasMore}
          isLoading={isLoading}
          isActionLoading={isActionLoading}
          actionError={actionError}
          onLoadMore={() => fetchReports(false)}
          onResolve={resolveReport}
        />
      )}
    </div>
  );
}
