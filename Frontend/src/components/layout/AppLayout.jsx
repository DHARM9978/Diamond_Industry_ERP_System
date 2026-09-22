import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Banknote,
  Clock,
  Fingerprint,
  Cpu,
  FileBarChart,
  Building2,
  Network,
  Activity,
  LogOut,
  Menu,
  X,
  Pin,
  PinOff,
  Gem,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

// ============================================================
// ADMIN NAVIGATION
// ============================================================

const adminNav = [
  {
    section: 'Overview',
    items: [{ to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    section: 'Workforce',
    items: [
      { to: '/admin/employees', icon: Users, label: 'Employees' },
      { to: '/admin/attendance', icon: CalendarCheck, label: 'Attendance' },
      { to: '/admin/live-attendance', icon: Activity, label: 'Live Attendance' },
      { to: '/admin/leaves', icon: CalendarDays, label: 'Leave Requests' },
      { to: '/admin/advances', icon: Banknote, label: 'Salary Advances' },
      { to: '/admin/payroll', icon: Wallet, label: 'Payroll' },
      { to: '/admin/bonus-payments', icon: Clock, label: 'Bonus Payments' },
      { to: '/admin/public-holidays', icon: CalendarDays, label: 'Public Holidays' },
    ],
  },
  {
    section: 'Fingerprint & Devices',
    items: [
      { to: '/admin/fingerprints', icon: Fingerprint, label: 'Fingerprints' },
      { to: '/admin/devices', icon: Cpu, label: 'Devices' },
    ],
  },
  {
    section: 'Organization',
    items: [
      { to: '/admin/company', icon: Building2, label: 'Company' },
      { to: '/admin/branches', icon: Network, label: 'Branches' },
      { to: '/admin/departments', icon: Network, label: 'Departments' },
    ],
  },
  {
    section: 'Insights',
    items: [{ to: '/admin/reports', icon: FileBarChart, label: 'Reports' }],
  },
];

// ============================================================
// EMPLOYEE NAVIGATION
// ============================================================

const employeeNav = [
  {
    section: 'My Space',
    items: [
      { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/employee/attendance', icon: CalendarCheck, label: 'My Attendance' },
      { to: '/employee/leaves', icon: CalendarDays, label: 'My Leaves' },
      { to: '/employee/advances', icon: Banknote, label: 'My Advances' },
      { to: '/employee/payroll', icon: Wallet, label: 'My Payroll' },
      { to: '/employee/bonuses', icon: Wallet, label: 'My Bonuses' },
      { to: '/employee/public-holidays', icon: CalendarDays, label: 'Public Holidays' },
      { to: '/employee/profile', icon: Users, label: 'My Profile' },
    ],
  },
];

// ============================================================
// SIDEBAR BEHAVIOUR CONSTANTS
//
// ROW_HEIGHT and LABEL_MAX_WIDTH are applied as inline styles
// (not Tailwind classes) on purpose: they guarantee every row is
// exactly the same height whether the sidebar is collapsed or
// expanded, regardless of whatever padding your own `sidebar-link`
// class defines elsewhere. Only WIDTH ever animates - height never
// does, on any row.
// ============================================================

const ROW_HEIGHT = 44; // px - change this if your rows should be taller/shorter
const LABEL_MAX_WIDTH = 160; // px - how wide a label may grow before truncating
const LEAVE_DELAY = 250; // ms grace period before auto-collapsing on mouse-out
const PIN_KEY = 'diamond-erp:sidebar-pinned';

function readStoredPin() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PIN_KEY) === 'true';
  } catch {
    return false;
  }
}

// ============================================================
// SIDEBAR CONTENT
//
// Declared as a top-level component (not inside AppLayout) on
// purpose - if it were declared inside AppLayout's body, React
// would treat it as a brand new component on every hover in/out
// and rebuild the whole tree from scratch instead of transitioning
// it, which would make every animation snap instead of gliding.
// ============================================================

function SidebarContent({
  nav,
  adminMode,
  currentPath,
  user,
  showLabels,
  pinned,
  showPinControl,
  onTogglePin,
  onNavigate,
  onLogout,
}) {
  const labelClass = `whitespace-nowrap overflow-hidden transition-all duration-200 ${
    showLabels ? 'opacity-100' : 'opacity-0'
  }`;
  const labelStyle = { maxWidth: showLabels ? LABEL_MAX_WIDTH : 0 };

  return (
    <div className="flex flex-col h-full w-full bg-navy-900 overflow-hidden">
      {/* ==================================================
          LOGO
      ================================================== */}
      <div
        className="flex items-center gap-3 px-4 border-b border-navy-800 shrink-0"
        style={{ height: ROW_HEIGHT + 32 }}
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shrink-0">
          <Gem size={20} className="text-white" />
        </div>

        <div className={labelClass} style={labelStyle}>
          <h1 className="text-white font-bold text-sm leading-tight">Diamond ERP</h1>
          <p className="text-navy-300 text-xs">{adminMode ? 'Admin Panel' : 'Employee Portal'}</p>
        </div>

        {showPinControl && showLabels && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? 'Auto-hide sidebar' : 'Keep sidebar open'}
            title={pinned ? 'Auto-hide sidebar' : 'Keep sidebar open'}
            className={`ml-auto shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-200 ${
              pinned
                ? 'text-accent-400 hover:bg-navy-800'
                : 'text-navy-400 hover:bg-navy-800 hover:text-white'
            }`}
          >
            {pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        )}
      </div>

      {/* ==================================================
          NAVIGATION
      ================================================== */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
        {nav.map((group) => (
          <div key={group.section} className="mb-4">
            <p
              className={`px-3 mb-1.5 h-4 text-xs font-semibold uppercase tracking-wider text-navy-400 overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
                showLabels ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {group.section}
            </p>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = currentPath === item.to;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    title={!showLabels ? item.label : ''}
                    aria-current={active ? 'page' : undefined}
                    style={{ height: ROW_HEIGHT }}
                    className={`sidebar-link flex items-center overflow-hidden px-3 transition-all duration-200 ${
                      active ? 'sidebar-link-active' : ''
                    } ${showLabels ? 'justify-start gap-3' : 'justify-center gap-0'}`}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className={labelClass} style={labelStyle}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ==================================================
          USER + LOGOUT
      ================================================== */}
      <div className="border-t border-navy-800 p-3 shrink-0">
        <div className="flex items-center gap-3" style={{ height: ROW_HEIGHT }}>
          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>

          <div className={`flex-1 ${labelClass}`} style={labelStyle}>
            <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-navy-400 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          title={!showLabels ? 'Sign Out' : ''}
          style={{ height: ROW_HEIGHT }}
          className={`sidebar-link w-full mt-2 overflow-hidden px-3 text-error-300 hover:bg-error-900/30 transition-all duration-200 ${
            showLabels ? 'justify-start gap-3' : 'justify-center gap-0'
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          <span className={labelClass} style={labelStyle}>
            Sign Out
          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// APP LAYOUT
// ============================================================

export function AppLayout({ children, adminMode = false }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Pinned = user explicitly locked the labels open.
  const [pinned, setPinned] = useState(readStoredPin);
  // Hovered = mouse (or keyboard focus) is currently on the rail/panel.
  const [hovered, setHovered] = useState(false);

  const leaveTimer = useRef(null);

  // Expanded exactly like a browser's vertical tab strip: hovering
  // previews it, pinning keeps it open without needing to hover.
  const expanded = pinned || hovered;

  const nav = adminMode ? adminNav : employeeNav;

  useEffect(() => {
    try {
      window.localStorage.setItem(PIN_KEY, String(pinned));
    } catch {
      // localStorage can be unavailable (private browsing, etc) - safe to ignore
    }
  }, [pinned]);

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    []
  );

  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), LEAVE_DELAY);
  };

  const togglePin = () => setPinned((prev) => !prev);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ==========================================================
  // MAIN LAYOUT
  // ==========================================================

  return (
    <div className="flex h-screen bg-navy-50 overflow-hidden">
      {/* ====================================================
          DESKTOP SIDEBAR

          The outer wrapper reserves 72px in the page layout at
          all times unless pinned. The inner panel is absolutely
          positioned and floats OVER the page while hover-
          previewing, so the main content never reflows during a
          preview - only pinning/unpinning does that. This is the
          same trick Edge/Arc use for their vertical tab rail.
      ==================================================== */}
      <div
        className={`hidden md:block relative shrink-0 transition-all duration-200 ${
          pinned ? 'w-64' : 'w-[72px]'
        }`}
      >
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleMouseEnter}
          onBlur={handleMouseLeave}
          className={`absolute inset-y-0 left-0 z-30 transition-all duration-200 ${
            expanded ? 'w-64' : 'w-[72px]'
          } ${hovered && !pinned ? 'shadow-2xl' : ''}`}
        >
          <SidebarContent
            nav={nav}
            adminMode={adminMode}
            currentPath={location.pathname}
            user={user}
            showLabels={expanded}
            pinned={pinned}
            showPinControl
            onTogglePin={togglePin}
            onNavigate={() => setMobileOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      </div>

      {/* ====================================================
          MOBILE SIDEBAR
      ==================================================== */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-navy-950/50"
            onClick={() => setMobileOpen(false)}
          />

          <div className="relative animate-slide-in w-64">
            <SidebarContent
              nav={nav}
              adminMode={adminMode}
              currentPath={location.pathname}
              user={user}
              showLabels
              pinned={pinned}
              showPinControl={false}
              onTogglePin={togglePin}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* MOBILE HEADER */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-navy-100">
          <button type="button" onClick={() => setMobileOpen(true)} className="text-navy-600">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <Gem size={14} className="text-white" />
            </div>
            <span className="font-semibold text-navy-900 text-sm">Diamond ERP</span>
          </div>

          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}