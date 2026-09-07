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

        const [
          profileResponse,
          summaryResponse,
        ] = await Promise.all([

          // ======================================================
          // REAL API
          // GET /api/me/profile
          //
          // selfService.profile() already unwraps:
          // response.data.data
          // ======================================================

          selfService.profile(),


          // ======================================================
          // REAL API
          // Employee Attendance Summary
          // ======================================================

          selfService.attendanceSummary(),

        ]);


        console.log(
          'Employee Profile:',
          profileResponse
        );

        console.log(
          'Employee Attendance Summary:',
          summaryResponse
        );


        // ======================================================
        // REAL PROFILE DATA
        // ======================================================

        setProfile(profileResponse);


        // ======================================================
        // REAL ATTENDANCE SUMMARY
        // ======================================================

        setSummary(summaryResponse);

      } catch (error) {

        console.error(
          'Failed to load employee dashboard:',
          error
        );


        // ======================================================
        // IMPORTANT
        //
        // Profile is now connected to the REAL API.
        // Do NOT fall back to mockEmployeeProfile.
        // ======================================================

        setProfile(null);


        // ======================================================
        // Attendance summary is still allowed to use the
        // temporary mock until its API response is finalized.
        // ======================================================

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

  // REAL /api/me/profile data
  const rawProfile = profile || {};


  // Attendance summary
  const s = summary || {};


  // ============================================================
  // Employee Name
  // ============================================================

  const firstName =
    rawProfile?.firstName || '';

  const lastName =
    rawProfile?.lastName || '';

  const fullName =
    `${firstName} ${lastName}`.trim() ||
    'Employee';


  // ============================================================
  // Employee ID
  // ============================================================

  const employeeId =
    rawProfile?.employeeId ?? 'N/A';


  // ============================================================
  // Department
  //
  // API:
  //
  // "department": {
  //   "departmentId": 1,
  //   "departmentName": "Information Technology"
  // }
  // ============================================================

  const department =
    rawProfile?.department?.departmentName ||
    'N/A';


  // ============================================================
  // Branch
  //
  // API:
  //
  // "branch": {
  //   "branchId": 1,
  //   "branchName": "Main Branch",
  //   "location": "Bangalore"
  // }
  // ============================================================

  const branch =
    rawProfile?.branch?.branchName ||
    'N/A';


  // ============================================================
  // Branch Location
  // ============================================================

  const branchLocation =
    rawProfile?.branch?.location ||
    'N/A';


  // ============================================================
  // Hire Date
  //
  // API field:
  // hireDate
  //
  // Currently:
  // "hireDate": null
  // ============================================================

  const joinDate =
    rawProfile?.hireDate
      ? new Date(
          rawProfile.hireDate
        ).toLocaleDateString(
          'en-IN',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }
        )
      : 'N/A';


  // ============================================================
  // Employee Role
  // ============================================================

  const role =
    rawProfile?.role ||
    'EMPLOYEE';


  // ============================================================
  // Employee Status
  // ============================================================

  const employeeStatus =
    rawProfile?.status ||
    'UNKNOWN';


  // ============================================================
  // Salary Rate Per Hour
  // ============================================================

  const salaryRatePerHour =
    Number(
      rawProfile?.salaryRatePerHour || 0
    );


  // ============================================================
  // Employee Initial
  // ============================================================

  const employeeInitial =
    firstName
      ?.charAt(0)
      ?.toUpperCase() ||
    'E';


  // ============================================================
  // Latest Existing Records
  //
  // TEMPORARY MOCK DATA
  //
  // These will be replaced with real APIs when we integrate:
  //
  // GET /api/me/payroll
  // GET /api/me/advances
  // GET /api/leave-requests
  //
  // ============================================================

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
        title={`Welcome, ${firstName || 'Employee'}!`}
        subtitle={`${role} · ${department}`}
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
            My Profile
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


            {/* Location */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Location
              </span>


              <span className="font-medium text-navy-800 text-right">
                {branchLocation}
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


            {/* Role */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Role
              </span>


              <span className="font-medium text-navy-800 text-right">
                {role}
              </span>

            </div>


            {/* Status */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Status
              </span>


              <span className="font-medium text-navy-800 text-right">
                {employeeStatus}
              </span>

            </div>


            {/* Hourly Rate */}

            <div className="flex justify-between gap-4">

              <span className="text-navy-500">
                Hourly Rate
              </span>


              <span className="font-medium text-navy-800 text-right">
                ₹{salaryRatePerHour.toLocaleString('en-IN')}/h
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
            Right Side
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


            {/* ==================================================
                My Attendance
            ================================================== */}

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


            {/* ==================================================
                My Leaves
            ================================================== */}

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


            {/* ==================================================
                My Advances
            ================================================== */}

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