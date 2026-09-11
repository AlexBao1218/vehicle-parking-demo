import { NavLink } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { PROGRAM_NAME } from '@/lib/brand';

export default function Header() {
  const { isAdmin, loading } = useAdmin();

  const thirdNav = loading
    ? null
    : isAdmin
      ? { path: '/admin', label: 'Approvals' }
      : { path: '/approval-history', label: 'My Requests' };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/30">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <h1 className="text-lg font-bold text-foreground tracking-tight shrink-0">
          {PROGRAM_NAME}
        </h1>
        <nav className="flex items-center gap-1">
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
        </nav>
      </div>
    </header>
  );
}
