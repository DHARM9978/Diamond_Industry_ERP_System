import { useState, useEffect } from 'react';

import {
  CalendarCheck,
  CalendarDays,
  Banknote,
  Wallet,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';

import {
  selfService,
} from '@/services/apiServices';

import {
  mockEmployeeProfile,
  mockEmployeeAttendanceSummary,
  mockEmployeeLeaves,
  mockEmployeeAdvances,
  mockEmployeePayroll,
} from '@/services/mockData';


export function EmployeeDashboard() {

  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);


  // ============================================================
  // Load Employee Dashboard Data
  // ============================================================

  useEffect(() => {

    const load = async () => {

      try {

        const [profileResponse, summaryResponse] =
          await Promise.all([
            selfService.profile(),
            selfService.attendanceSummary(),
          ]);


        console.log(
          'Employee Profile Response:',
          profileResponse
        );

        console.log(
          'Employee Attendance Summary:',
          summaryResponse
        );


        setProfile(profileResponse);
        setSummary(summaryResponse);

      } catch (error) {

        console.error(
          'Failed to load employee dashboard:',
          error
        );

        /*
         * Temporary fallback to mock data.
         *
         * We can remove this after all employee dashboard
         * APIs are connected and tested.
         */

        setProfile(mockEmployeeProfile);
        setSummary(mockEmployeeAttendanceSummary);

      } finally {

        setLoading(false);

      }

    };


    load();

  }, []);


  // ============================================================
  // Loading State
  // ============================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading your dashboard..."
      />
    );

  }


  // ============================================================
  // Raw Data
  // ============================================================

  const rawProfile =
    profile || mockEmployeeProfile;

  const s =
    summary || mockEmployeeAttendanceSummary;


  // ============================================================
  // Normalize Employee Profile
  // ============================================================

  /*
   * Backend may return:
   *
   * department: {
   *   departmentId,
   *   departmentName
   * }
   *
   * branch: {
   *   branchId,
   *   branchName
   * }
   *
   * The frontend must display the NAME, not the entire object.
   */


  const firstName =
    rawProfile?.firstName ||
    rawProfile?.first_name ||
    '';

  const lastName =
    rawProfile?.lastName ||
    rawProfile?.last_name ||
    '';

  const fullName =
    rawProfile?.name ||
    `${firstName} ${lastName}`.trim() ||
    'Employee';


  const employeeId =
    rawProfile?.employeeId ||
    rawProfile?.employee_id ||
    'N/A';


  const designation =
    rawProfile?.designation ||
    rawProfile?.jobTitle ||
    rawProfile?.job_title ||
    '';


  // ============================================================
  // Department
  // ============================================================

  const department =
    typeof rawProfile?.department === 'object'
      ? (
          rawProfile.department?.departmentName ||
          rawProfile.department?.name ||
          'N/A'
        )
      : (
          rawProfile?.department ||
          'N/A'
        );


  // ============================================================
  // Branch
  // ============================================================

  const branch =
    typeof rawProfile?.branch === 'object'
      ? (
          rawProfile.branch?.branchName ||
          rawProfile.branch?.name ||
          'N/A'
        )
      : (
          rawProfile?.branch ||
          'N/A'
        );


  // ============================================================
  // Join Date
  // ============================================================

  const joinDate =
    rawProfile?.joinDate ||
    rawProfile?.join_date ||
    'N/A';


  // ============================================================
  // Employee Initial
  // ============================================================

  const employeeInitial =
    fullName
      ?.charAt(0)
      ?.toUpperCase() || 'E';


  // ============================================================
  // Latest Existing Records
  // ============================================================

  /*
   * Payroll, advances and leaves are still using the existing
   * mock data at this stage.
   *
   * We will connect these to their real APIs in their respective
   * modules later.
   */

  const latestPayroll =
    mockEmployeePayroll?.[0];

  const latestAdvance =
    mockEmployeeAdvances?.[0];

  const latestLeave =
    mockEmployeeLeaves?.[0];


  // ============================================================
  // Safe Attendance Values
  // ============================================================

  const present =
    s?.present ?? 0;

  const absent =
    s?.absent ?? 0;

  const late =
    s?.late ?? 0;

  const attendanceRate =
    s?.attendance_rate ??
    s?.attendanceRate ??
    0;

  const totalHours =
    s?.total_hours ??
    s?.totalHours ??
    0;


  // ============================================================
  // Render
  // ============================================================

  return (

    <div>

      {/* ======================================================
          Page Header
      ====================================================== */}

      <PageHeader
        title={`Welcome, ${fullName.split(' ')[0]}!`}
        subtitle={
          designation
            ? `${designation} · ${department}`
            : 'Employee Portal'
        }
      />


      {/* ======================================================
          Attendance Statistics
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <StatCard
          icon={UserCheck}
          label="Present Days"
          value={present}
          color="success"
        />

        <StatCard
          icon={UserX}
          label="Absent Days"
          value={absent}
          color="error"
        />

        <StatCard
          icon={Clock}
          label="Late Arrivals"
          value={late}
          color="warning"
        />

        <StatCard
          icon={TrendingUp}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          color="accent"
        />

      </div>


      {/* ======================================================
          Main Dashboard
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


        {/* ====================================================
            Profile Card
        ==================================================== */}

        <div className="card p-6">

          <h3 className="font-semibold text-navy-900 mb-4">
            My Profile
          </h3>


          {/* Employee Identity */}

          <div className="flex items-center gap-4 mb-4">

            <div
              className="
                w-16 h-16
                rounded-full
                bg-gradient-to-br
                from-navy-700
                to-navy-900
                flex items-center
                justify-center
              "
            >

              <span className="text-2xl font-bold text-white">
                {employeeInitial}
              </span>

            </div>


            <div>

              <p className="font-semibold text-navy-900">
                {fullName}
              </p>

              <p className="text-sm text-navy-500">
                {employeeId}
              </p>

            </div>

          </div>


          {/* Profile Details */}

          <div className="space-y-2 text-sm">


            {/* Department */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Department
              </span>

              <span className="font-medium text-navy-800 text-right">
                {department}
              </span>

            </div>


            {/* Branch */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Branch
              </span>

              <span className="font-medium text-navy-800 text-right">
                {branch}
              </span>

            </div>


            {/* Join Date */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Join Date
              </span>

              <span className="font-medium text-navy-800 text-right">
                {joinDate}
              </span>

            </div>


            {/* Total Hours */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Total Hours
              </span>

              <span className="font-medium text-navy-800 text-right">
                {totalHours}h
              </span>

            </div>

          </div>

        </div>


        {/* ====================================================
            Recent Items
        ==================================================== */}

        <div className="lg:col-span-2 space-y-6">


          {/* ==================================================
              Latest Payroll
          ================================================== */}

          <div className="card p-6">

            <div className="flex items-center justify-between mb-4">

              <div className="flex items-center gap-2">

                <Wallet
                  size={20}
                  className="text-navy-600"
                />

                <h3 className="font-semibold text-navy-900">
                  Latest Payslip
                </h3>

              </div>


              {latestPayroll && (
                <StatusBadge
                  status={latestPayroll.status}
                />
              )}

            </div>


            {latestPayroll && (

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">


                {/* Month */}

                <div>

                  <p className="text-xs text-navy-400">
                    Month
                  </p>

                  <p className="text-sm font-medium text-navy-800">
                    {latestPayroll.month}
                  </p>

                </div>


                {/* Basic */}

                <div>

                  <p className="text-xs text-navy-400">
                    Basic
                  </p>

                  <p className="text-sm font-medium text-navy-800">

                    ₹
                    {Number(
                      latestPayroll.basic_salary || 0
                    ).toLocaleString('en-IN')}

                  </p>

                </div>


                {/* Deductions */}

                <div>

                  <p className="text-xs text-navy-400">
                    Deductions
                  </p>

                  <p className="text-sm font-medium text-error-600">

                    ₹
                    {Number(
                      (latestPayroll.deductions || 0) +
                      (latestPayroll.advance_deduction || 0)
                    ).toLocaleString('en-IN')}

                  </p>

                </div>


                {/* Net Pay */}

                <div>

                  <p className="text-xs text-navy-400">
                    Net Pay
                  </p>

                  <p className="text-sm font-bold text-navy-900">

                    ₹
                    {Number(
                      latestPayroll.net_salary || 0
                    ).toLocaleString('en-IN')}

                  </p>

                </div>

              </div>

            )}

          </div>


          {/* ==================================================
              Quick Links
          ================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">


            {/* Attendance */}

            <div className="card-hover p-5">

              <CalendarCheck
                size={22}
                className="text-accent-600 mb-2"
              />

              <p className="font-medium text-navy-900 text-sm">
                My Attendance
              </p>

              <p className="text-xs text-navy-500 mt-1">
                {present} present, {late} late this month
              </p>

            </div>


            {/* Leaves */}

            <div className="card-hover p-5">

              <CalendarDays
                size={22}
                className="text-success-600 mb-2"
              />

              <p className="font-medium text-navy-900 text-sm">
                My Leaves
              </p>

              <p className="text-xs text-navy-500 mt-1">

                {
                  latestLeave?.status === 'approved'
                    ? 'Latest leave approved'
                    : 'No active leaves'
                }

              </p>

            </div>


            {/* Advances */}

            <div className="card-hover p-5">

              <Banknote
                size={22}
                className="text-warning-600 mb-2"
              />

              <p className="font-medium text-navy-900 text-sm">
                My Advances
              </p>

              <p className="text-xs text-navy-500 mt-1">

                {
                  latestAdvance
                    ? `₹${Number(
                        latestAdvance.remaining || 0
                      ).toLocaleString('en-IN')} remaining`
                    : 'No active advances'
                }

              </p>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}