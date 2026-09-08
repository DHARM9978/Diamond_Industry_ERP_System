import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminEmployees } from '@/pages/admin/AdminEmployees';
import { AdminAttendance } from '@/pages/admin/AdminAttendance';
import { AdminLiveAttendance } from '@/pages/admin/AdminLiveAttendance';
import { AdminLeaves } from '@/pages/admin/AdminLeaves';
import { AdminAdvances } from '@/pages/admin/AdminAdvances';
import { AdminPayroll } from '@/pages/admin/AdminPayroll';
import { AdminFingerprints } from '@/pages/admin/AdminFingerprints';
import { AdminDevices } from '@/pages/admin/AdminDevices';
import { AdminCompany } from '@/pages/admin/AdminCompany';
import { AdminBranches } from '@/pages/admin/AdminBranches';
import { AdminDepartments } from '@/pages/admin/AdminDepartments';
import { AdminReports } from '@/pages/admin/AdminReports';

import { EmployeeDashboard } from '@/pages/employee/EmployeeDashboard';
import { EmployeeAttendance } from '@/pages/employee/EmployeeAttendance';
import { EmployeeLeaves } from '@/pages/employee/EmployeeLeaves';
import { EmployeeAdvances } from '@/pages/employee/EmployeeAdvances';
import { EmployeePayroll } from '@/pages/employee/EmployeePayroll';
import { EmployeeProfile } from '@/pages/employee/EmployeeProfile';


function App() {

  return (
    <BrowserRouter>

      <AuthProvider>

        <ToastProvider>

          <Routes>

            {/* ==================================================
                LOGIN
            ================================================== */}

            <Route
              path="/login"
              element={<LoginPage />}
            />


            {/* ==================================================
                ADMIN ROUTES
            ================================================== */}

            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <Navigate
                      to="/admin/dashboard"
                      replace
                    />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminEmployees />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            {/* ==================================================
                EXISTING ATTENDANCE
            ================================================== */}

            <Route
              path="/admin/attendance"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminAttendance />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/live-attendance"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminLiveAttendance />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            {/* ==================================================
                LIVE ATTENDANCE
            ================================================== */}

            <Route
              path="/admin/live-attendance"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminLiveAttendance />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/leaves"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminLeaves />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/advances"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminAdvances />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/payroll"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminPayroll />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/fingerprints"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminFingerprints />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/devices"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminDevices />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/company"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminCompany />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/branches"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminBranches />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/departments"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminDepartments />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute adminOnly>
                  <AppLayout adminMode>
                    <AdminReports />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            {/* ==================================================
                EMPLOYEE ROUTES
            ================================================== */}

            <Route
              path="/employee"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Navigate
                      to="/employee/dashboard"
                      replace
                    />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmployeeDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/employee/attendance"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmployeeAttendance />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/employee/leaves"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmployeeLeaves />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/employee/advances"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmployeeAdvances />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/employee/payroll"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmployeePayroll />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            <Route
              path="/employee/profile"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EmployeeProfile />
                  </AppLayout>
                </ProtectedRoute>
              }
            />


            {/* ==================================================
                FALLBACK
            ================================================== */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/login"
                  replace
                />
              }
            />

          </Routes>

        </ToastProvider>

      </AuthProvider>

    </BrowserRouter>
  );
}


export default App;