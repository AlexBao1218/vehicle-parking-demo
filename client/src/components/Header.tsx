import { NavLink } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { PROGRAM_NAME } from '@/lib/brand';
import { resetDemoData } from '@/platform/store';

export default function Header() {
  const { isAdmin, loading, viewAsUser, toggleViewAsUser } = useAdmin();

  const thirdNav = loading
    ? null
    : isAdmin && !viewAsUser
      ? { path: '/admin', label: 'Approvals' }
      : { path: '/approval-history', label: 'My Requests' };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/30">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-1 py-2 sm:py-0 px-2 md:px-6">
        <h1 className="text-sm sm:text-lg font-bold text-foreground tracking-tight shrink-0">
          {PROGRAM_NAME}
        </h1>
        <nav className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`
              }
            >
              Search
            </NavLink>
            <NavLink
              to="/apply"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`
              }
            >
              New Request
            </NavLink>
            {thirdNav && (
              <NavLink
                to={thirdNav.path}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`
                }
              >
                {thirdNav.label}
              </NavLink>
            )}
            <button type="button" onClick={toggleViewAsUser} className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent">{viewAsUser?'Admin view':'User view'}</button>
            <span aria-hidden className="mx-1 h-4 w-px bg-border/60" />
            <button
              type="button"
              onClick={() => {
                resetDemoData();
                window.location.assign('/');
              }}
              title="Restore the seeded demo data"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset data</span>
              <span className="sr-only sm:hidden">Reset data</span>
            </button>
        </nav>
      </div>
    </header>
  );
}
