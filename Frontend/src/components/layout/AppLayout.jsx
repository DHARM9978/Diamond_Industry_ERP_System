import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
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
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Gem,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const adminNav = [
  { section: 'Overview', items: [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ]},
  { section: 'Workforce', items: [
    { to: '/admin/employees', icon: Users, label: 'Employees' },
    { to: '/admin/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/admin/leaves', icon: CalendarDays, label: 'Leave Requests' },
    { to: '/admin/advances', icon: Banknote, label: 'Salary Advances' },
    { to: '/admin/payroll', icon: Wallet, label: 'Payroll' },
  ]},
  { section: 'Fingerprint & Devices', items: [
    { to: '/admin/fingerprints', icon: Fingerprint, label: 'Fingerprints' },
    { to: '/admin/devices', icon: Cpu, label: 'Devices' },
  ]},
  { section: 'Organization', items: [
    { to: '/admin/company', icon: Building2, label: 'Company' },
    { to: '/admin/branches', icon: Network, label: 'Branches' },
    { to: '/admin/departments', icon: Network, label: 'Departments' },
  ]},
  { section: 'Insights', items: [
    { to: '/admin/reports', icon: FileBarChart, label: 'Reports' },
  ]},
];

const employeeNav = [
  { section: 'My Space', items: [
    { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/employee/attendance', icon: CalendarCheck, label: 'My Attendance' },
    { to: '/employee/leaves', icon: CalendarDays, label: 'My Leaves' },
    { to: '/employee/advances', icon: Banknote, label: 'My Advances' },
    { to: '/employee/payroll', icon: Wallet, label: 'My Payroll' },
    { to: '/employee/profile', icon: Users, label: 'My Profile' },
  ]},
];

export function AppLayout({ children, adminMode = false }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const nav = adminMode ? adminNav : employeeNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className={`flex flex-col h-full ${collapsed ? 'w-[72px]' : 'w-64'} transition-all duration-200 bg-navy-900`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-navy-800">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shrink-0">
          <Gem size={20} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-white font-bold text-sm leading-tight">Diamond ERP</h1>
            <p className="text-navy-300 text-xs">{adminMode ? 'Admin Panel' : 'Employee Portal'}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {nav.map((group) => (
          <div key={group.section} className="mb-4">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-navy-400">{group.section}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`sidebar-link ${active ? 'sidebar-link-active' : ''} ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? item.label : ''}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-navy-800 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-navy-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={handleLogout} className="sidebar-link w-full mt-2 text-error-300 hover:bg-error-900/30">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-navy-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col">
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-0 bottom-0 p-2 text-navy-400 hover:text-white transition-colors"
          style={{ left: collapsed ? '56px' : '248px', transition: 'left 0.2s' }}
        >
          <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setMobileOpen(false)} />
          <div className="relative animate-slide-in">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-navy-100">
          <button onClick={() => setMobileOpen(true)} className="text-navy-600">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <Gem size={14} className="text-white" />
            </div>
            <span className="font-semibold text-navy-900 text-sm">Diamond ERP</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
