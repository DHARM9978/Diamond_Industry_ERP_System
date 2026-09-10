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


export function EmployeeDashboard() {

  // ============================================================
  // STATE
  // ============================================================

  const [profile, setProfile] =
    useState(null);

  const [summary, setSummary] =
    useState(null);

  const [payroll, setPayroll] =
    useState([]);

  const [advances, setAdvances] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);


  // ============================================================
  // Helper
  // ============================================================

  const normalizeArray = (
    response
  ) => {

    if (Array.isArray(response)) {
      return response;
    }

    if (
      Array.isArray(
        response?.data
      )
    ) {
      return response.data;
    }

    return [];
  };


  const toNumber = (
    value
  ) => {

    const numberValue =
      Number(value);

    return Number.isFinite(
      numberValue
    )
      ? numberValue
      : 0;
  };


  const formatCurrency = (
    value
  ) => {

    return `₹${toNumber(
      value
    ).toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };


  const formatDate = (
    value
  ) => {

    if (!value) {
      return 'N/A';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'N/A';
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };


  // ============================================================
  // Load Employee Dashboard
  // ============================================================

  useEffect(() => {

    let mounted = true;


    const loadDashboard =
      async () => {

        try {

          setLoading(true);

          setError(null);


          // ======================================================
          // Load all real employee data
          // ======================================================

          const results =
            await Promise.allSettled([

              selfService.profile(),

              selfService.attendanceSummary(),

              selfService.payroll(),

              selfService.advances(),

            ]);


          // ======================================================
          // Profile
          // ======================================================

          if (
            results[0].status ===
            'fulfilled'
          ) {

            if (mounted) {

              setProfile(
                results[0].value
              );
            }

          } else {

            throw (
              results[0].reason ||
              new Error(
                'Unable to load employee profile'
              )
            );
          }


          // ======================================================
          // Attendance Summary
          // ======================================================

          if (
            results[1].status ===
            'fulfilled'
          ) {

            if (mounted) {

              setSummary(
                results[1].value
              );
            }

          } else {

            console.error(
              'Attendance summary failed:',
              results[1].reason
            );

            if (mounted) {

              setSummary(
                {}
              );
            }
          }


          // ======================================================
          // Payroll
          // ======================================================

          if (
            results[2].status ===
            'fulfilled'
          ) {

            if (mounted) {

              setPayroll(
                normalizeArray(
                  results[2].value
                )
              );
            }

          } else {

            console.error(
              'Payroll loading failed:',
              results[2].reason
            );

            if (mounted) {

              setPayroll([]);
            }
          }


          // ======================================================
          // Advances
          // ======================================================

          if (
            results[3].status ===
            'fulfilled'
          ) {

            if (mounted) {

              setAdvances(
                normalizeArray(
                  results[3].value
                )
              );
            }

          } else {

            console.error(
              'Advance loading failed:',
              results[3].reason
            );

            if (mounted) {

              setAdvances([]);
            }
          }

        } catch (loadError) {

          console.error(
            'Failed to load employee dashboard:',
            loadError
          );


          if (mounted) {

            setError(
              loadError?.message ||
              'Unable to load employee dashboard'
            );

          }

        } finally {

          if (mounted) {

            setLoading(false);

          }
        }
      };


    loadDashboard();


    return () => {

      mounted = false;

    };

  }, []);


  // ============================================================
  // Loading
  // ============================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading your dashboard..."
      />
    );

  }


  // ============================================================
  // Error
  // ============================================================

  if (error) {

    return (

      <div>

        <PageHeader
          title="Employee Dashboard"
          subtitle="Overview of your attendance, salary and advance information"
        />

        <div className="card p-6">

          <div
            className="
              rounded-lg
              bg-error-50
              p-4
            "
          >

            <p
              className="
                font-semibold
                text-error-800
              "
            >
              Unable to load dashboard
            </p>


            <p
              className="
                mt-1
                text-sm
                text-error-700
              "
            >
              {error}
            </p>

          </div>

        </div>

      </div>

    );
  }


  // ============================================================
  // Raw Data
  // ============================================================

  const rawProfile =
    profile || {};

  const s =
    summary || {};


  // ============================================================
  // Employee Identity
  // ============================================================

  const firstName =
    rawProfile?.firstName ||
    '';

  const lastName =
    rawProfile?.lastName ||
    '';

  const fullName =
    `${firstName} ${lastName}`.trim() ||
    'Employee';


  const employeeId =
    rawProfile?.employeeId ??
    'N/A';


  // ============================================================
  // Department
  // ============================================================

  const department =
    rawProfile?.department?.departmentName ||
    'N/A';


  // ============================================================
  // Branch
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
  // ============================================================

  const joinDate =
    formatDate(
      rawProfile?.hireDate
    );


  // ============================================================
  // Role
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
  // Salary Configuration
  // ============================================================

  const baseSalary =
    toNumber(
      rawProfile?.baseSalary
    );


  const monthlyExpectedHours =
    toNumber(
      rawProfile?.monthlyExpectedHours
    );


  const salaryRatePerHour =
    toNumber(
      rawProfile?.salaryRatePerHour
    );


  // ============================================================
  // Initial
  // ============================================================

  const employeeInitial =
    firstName
      ?.charAt(0)
      ?.toUpperCase() ||
    'E';


  // ============================================================
  // Attendance Summary
  //
  // Service returns:
  //
  // presentDays
  // absentDays
  // totalHours
  // averageHours
  // ============================================================

  const present =
    toNumber(
      s?.presentDays ??
      s?.present ??
      0
    );


  const absent =
    toNumber(
      s?.absentDays ??
      s?.absent ??
      0
    );


  const totalHours =
    toNumber(
      s?.totalHours ??
      s?.total_hours ??
      0
    );


  const averageHours =
    toNumber(
      s?.averageHours ??
      s?.average_hours ??
      0
    );


  // ============================================================
  // Attendance Rate
  //
  // The current attendance summary service returns counts rather
  // than attendanceRate, so calculate it from total days.
  // ============================================================

  const totalAttendanceDays =
    toNumber(
      s?.totalDays ??
      (
        present +
        absent
      )
    );


  const attendanceRate =
    totalAttendanceDays > 0
      ? Number(
          (
            (
              present /
              totalAttendanceDays
            ) *
            100
          ).toFixed(2)
        )
      : 0;


  // ============================================================
  // Late
  //
  // The current employee attendance summary does not expose
  // a separate late count.
  //
  // Therefore we do not invent a value.
  // ============================================================

  const late = 0;


  // ============================================================
  // Latest Payroll
  // ============================================================

  const latestPayroll =
    payroll.length > 0
      ? payroll[0]
      : null;


  // ============================================================
  // Latest Advance
  // ============================================================

  const latestAdvance =
    advances.length > 0
      ? advances[0]
      : null;


  // ============================================================
  // Advance Amounts
  //
  // requested = amount
  // approved = approvedAmount
  // paid = paidAmount
  // ============================================================

  const latestAdvanceRequested =
    toNumber(
      latestAdvance?.amount
    );


  const latestAdvanceApproved =
    toNumber(
      latestAdvance?.approvedAmount
    );


  const latestAdvancePaid =
    toNumber(
      latestAdvance?.paidAmount
    );


  // ============================================================
  // Payroll Fields
  // ============================================================

  const payrollBaseSalary =
    toNumber(
      latestPayroll?.baseSalary
    );


  const payrollExpectedHours =
    toNumber(
      latestPayroll?.monthlyExpectedHours
    );


  const payrollHourlyRate =
    toNumber(
      latestPayroll?.salaryRatePerHour
    );


  const payrollWorkingHours =
    toNumber(
      latestPayroll?.totalWorkingHours
    );


  const payrollBasicSalary =
    toNumber(
      latestPayroll?.basicSalary
    );


  const payrollAdvanceDeduction =
    toNumber(
      latestPayroll?.advanceDeduction
    );


  const payrollNetSalary =
    toNumber(
      latestPayroll?.netSalary
    );


  // ============================================================
  // Payroll Status
  // ============================================================

  const payrollStatus =
    latestPayroll?.status ||
    'PROCESSED';


  // ============================================================
  // Payroll Period
  // ============================================================

  const payrollPeriodStart =
    formatDate(
      latestPayroll?.payPeriodStart
    );


  const payrollPeriodEnd =
    formatDate(
      latestPayroll?.payPeriodEnd
    );


  const payrollPaymentDate =
    formatDate(
      latestPayroll?.paymentDate
    );


  // ============================================================
  // Salary Used For Dashboard
  // ============================================================

  const displayBaseSalary =
    payrollBaseSalary ||
    baseSalary;


  const displayExpectedHours =
    payrollExpectedHours ||
    monthlyExpectedHours;


  const displayHourlyRate =
    payrollHourlyRate ||
    salaryRatePerHour;


  // ============================================================
  // Render
  // ============================================================

  return (

    <div>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader
        title={`Welcome, ${firstName || 'Employee'}!`}
        subtitle={`${role} · ${department}`}
      />


      {/* ======================================================
          ATTENDANCE STATISTICS
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-4
          gap-4
          mb-6
        "
      >

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
          MAIN DASHBOARD
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-3
          gap-6
        "
      >

        {/* ====================================================
            PROFILE
        ==================================================== */}

        <div className="card p-6">

          <h3
            className="
              font-semibold
              text-navy-900
              mb-4
            "
          >
            My Profile
          </h3>


          {/* Employee Identity */}

          <div
            className="
              flex
              items-center
              gap-4
              mb-5
            "
          >

            <div
              className="
                w-16
                h-16
                rounded-full
                bg-gradient-to-br
                from-navy-700
                to-navy-900
                flex
                items-center
                justify-center
              "
            >

              <span
                className="
                  text-2xl
                  font-bold
                  text-white
                "
              >
                {employeeInitial}
              </span>

            </div>


            <div>

              <p
                className="
                  font-semibold
                  text-navy-900
                "
              >
                {fullName}
              </p>


              <p
                className="
                  text-sm
                  text-navy-500
                "
              >
                Employee ID: {employeeId}
              </p>

            </div>

          </div>


          {/* Profile Details */}

          <div
            className="
              space-y-3
              text-sm
            "
          >

            <div
              className="
                flex
                justify-between
                gap-4
              "
            >

              <span className="text-navy-500">
                Department
              </span>

              <span
                className="
                  font-medium
                  text-navy-800
                  text-right
                "
              >
                {department}
              </span>

            </div>


            <div
              className="
                flex
                justify-between
                gap-4
              "
            >

              <span className="text-navy-500">
                Branch
              </span>

              <span
                className="
                  font-medium
                  text-navy-800
                  text-right
                "
              >
                {branch}
              </span>

            </div>


            <div
              className="
                flex
                justify-between
                gap-4
              "
            >

              <span className="text-navy-500">
                Location
              </span>

              <span
                className="
                  font-medium
                  text-navy-800
                  text-right
                "
              >
                {branchLocation}
              </span>

            </div>


            <div
              className="
                flex
                justify-between
                gap-4
              "
            >

              <span className="text-navy-500">
                Join Date
              </span>

              <span
                className="
                  font-medium
                  text-navy-800
                  text-right
                "
              >
                {joinDate}
              </span>

            </div>


            <div
              className="
                flex
                justify-between
                gap-4
              "
            >

              <span className="text-navy-500">
                Role
              </span>

              <span
                className="
                  font-medium
                  text-navy-800
                  text-right
                "
              >
                {role}
              </span>

            </div>


            <div
              className="
                flex
                justify-between
                gap-4
              "
            >

              <span className="text-navy-500">
                Status
              </span>

              <span
                className="
                  font-medium
                  text-navy-800
                  text-right
                "
              >
                {employeeStatus}
              </span>

            </div>

          </div>


          {/* ==================================================
              SALARY CONFIGURATION
          ================================================== */}

          <div
            className="
              mt-6
              pt-5
              border-t
              border-navy-100
            "
          >

            <h4
              className="
                font-semibold
                text-navy-900
                mb-3
              "
            >
              Salary Configuration
            </h4>


            <div className="space-y-3 text-sm">


              {/* Base Salary */}

              <div
                className="
                  flex
                  justify-between
                  gap-4
                "
              >

                <span className="text-navy-500">
                  Base / Monthly Salary
                </span>

                <span
                  className="
                    font-semibold
                    text-navy-900
                  "
                >
                  {formatCurrency(
                    displayBaseSalary
                  )}
                </span>

              </div>


              {/* Expected Hours */}

              <div
                className="
                  flex
                  justify-between
                  gap-4
                "
              >

                <span className="text-navy-500">
                  Expected Hours / Month
                </span>

                <span
                  className="
                    font-semibold
                    text-navy-900
                  "
                >
                  {displayExpectedHours
                    ? `${displayExpectedHours} hrs`
                    : 'N/A'}
                </span>

              </div>


              {/* Hourly Rate */}

              <div
                className="
                  flex
                  justify-between
                  gap-4
                "
              >

                <span className="text-navy-500">
                  Hourly Rate
                </span>

                <span
                  className="
                    font-semibold
                    text-accent-700
                  "
                >
                  {displayHourlyRate
                    ? `${formatCurrency(
                        displayHourlyRate
                      )}/hr`
                    : 'N/A'}
                </span>

              </div>

            </div>

          </div>


          {/* ==================================================
              CURRENT HOURS
          ================================================== */}

          <div
            className="
              mt-6
              rounded-lg
              bg-navy-50
              p-4
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
              "
            >

              <div>

                <p
                  className="
                    text-xs
                    text-navy-500
                  "
                >
                  Total Hours Worked
                </p>

                <p
                  className="
                    text-xl
                    font-bold
                    text-navy-900
                  "
                >
                  {totalHours} hrs
                </p>

              </div>


              <Clock
                size={24}
                className="text-navy-600"
              />

            </div>


            <p
              className="
                mt-1
                text-xs
                text-navy-500
              "
            >
              Average: {averageHours} hrs/day
            </p>

          </div>

        </div>


        {/* ====================================================
            RIGHT SIDE
        ==================================================== */}

        <div
          className="
            lg:col-span-2
            space-y-6
          "
        >

          {/* ==================================================
              LATEST PAYROLL
          ================================================== */}

          <div className="card p-6">

            <div
              className="
                flex
                items-center
                justify-between
                mb-4
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <Wallet
                  size={20}
                  className="text-navy-600"
                />

                <h3
                  className="
                    font-semibold
                    text-navy-900
                  "
                >
                  Latest Payslip
                </h3>

              </div>


              {latestPayroll && (

                <StatusBadge
                  status={
                    payrollStatus
                  }
                />

              )}

            </div>


            {!latestPayroll ? (

              <div
                className="
                  rounded-lg
                  bg-navy-50
                  p-4
                  text-sm
                  text-navy-500
                "
              >
                No payroll record available yet.
              </div>

            ) : (

              <div className="space-y-5">


                {/* ==================================================
                    PAY PERIOD
                ================================================== */}

                <div
                  className="
                    rounded-lg
                    bg-navy-50
                    p-4
                  "
                >

                  <p
                    className="
                      text-xs
                      text-navy-400
                    "
                  >
                    Pay Period
                  </p>


                  <p
                    className="
                      text-sm
                      font-semibold
                      text-navy-800
                      mt-1
                    "
                  >
                    {payrollPeriodStart}
                    {' '}
                    -
                    {' '}
                    {payrollPeriodEnd}
                  </p>


                  <p
                    className="
                      text-xs
                      text-navy-500
                      mt-1
                    "
                  >
                    Payment Date:
                    {' '}
                    {payrollPaymentDate}
                  </p>

                </div>


                {/* ==================================================
                    PAYROLL SUMMARY CARDS
                ================================================== */}

                <div
                  className="
                    grid
                    grid-cols-2
                    md:grid-cols-4
                    gap-4
                  "
                >

                  {/* Base Salary */}

                  <div>

                    <p className="text-xs text-navy-400">
                      Base Salary
                    </p>

                    <p
                      className="
                        text-sm
                        font-semibold
                        text-navy-800
                        mt-1
                      "
                    >
                      {formatCurrency(
                        displayBaseSalary
                      )}
                    </p>

                  </div>


                  {/* Expected Hours */}

                  <div>

                    <p className="text-xs text-navy-400">
                      Expected Hrs
                    </p>

                    <p
                      className="
                        text-sm
                        font-semibold
                        text-navy-800
                        mt-1
                      "
                    >
                      {displayExpectedHours} hrs
                    </p>

                  </div>


                  {/* Hourly Rate */}

                  <div>

                    <p className="text-xs text-navy-400">
                      Hourly Rate
                    </p>

                    <p
                      className="
                        text-sm
                        font-semibold
                        text-navy-800
                        mt-1
                      "
                    >
                      {formatCurrency(
                        displayHourlyRate
                      )}
                    </p>

                  </div>


                  {/* Actual Hours */}

                  <div>

                    <p className="text-xs text-navy-400">
                      Actual Hrs
                    </p>

                    <p
                      className="
                        text-sm
                        font-semibold
                        text-navy-800
                        mt-1
                      "
                    >
                      {payrollWorkingHours} hrs
                    </p>

                  </div>

                </div>


                {/* ==================================================
                    EARNED / DEDUCTION / NET
                ================================================== */}

                <div
                  className="
                    grid
                    grid-cols-1
                    sm:grid-cols-3
                    gap-4
                  "
                >

                  {/* Earned Salary */}

                  <div
                    className="
                      rounded-lg
                      bg-success-50
                      p-4
                    "
                  >

                    <p
                      className="
                        text-xs
                        text-success-700
                      "
                    >
                      Earned Salary
                    </p>


                    <p
                      className="
                        mt-1
                        text-lg
                        font-bold
                        text-success-800
                      "
                    >
                      {formatCurrency(
                        payrollBasicSalary
                      )}
                    </p>

                  </div>


                  {/* Advance Deduction */}

                  <div
                    className="
                      rounded-lg
                      bg-error-50
                      p-4
                    "
                  >

                    <p
                      className="
                        text-xs
                        text-error-700
                      "
                    >
                      Advance Deduction
                    </p>


                    <p
                      className="
                        mt-1
                        text-lg
                        font-bold
                        text-error-800
                      "
                    >
                      {formatCurrency(
                        payrollAdvanceDeduction
                      )}
                    </p>

                  </div>


                  {/* Net Salary */}

                  <div
                    className="
                      rounded-lg
                      bg-accent-50
                      p-4
                    "
                  >

                    <p
                      className="
                        text-xs
                        text-accent-700
                      "
                    >
                      Net Salary
                    </p>


                    <p
                      className="
                        mt-1
                        text-lg
                        font-bold
                        text-accent-800
                      "
                    >
                      {formatCurrency(
                        payrollNetSalary
                      )}
                    </p>

                  </div>

                </div>

              </div>

            )}

          </div>


          {/* ==================================================
              LATEST ADVANCE
          ================================================== */}

          <div className="card p-6">

            <div
              className="
                flex
                items-center
                gap-2
                mb-4
              "
            >

              <Banknote
                size={20}
                className="text-navy-600"
              />

              <h3
                className="
                  font-semibold
                  text-navy-900
                "
              >
                Latest Advance
              </h3>

            </div>


            {!latestAdvance ? (

              <div
                className="
                  rounded-lg
                  bg-navy-50
                  p-4
                  text-sm
                  text-navy-500
                "
              >
                No advance request found.
              </div>

            ) : (

              <div className="space-y-4">


                {/* Advance Status */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-navy-500
                    "
                  >
                    Status
                  </span>


                  <StatusBadge
                    status={
                      latestAdvance?.status ||
                      'PENDING'
                    }
                  />

                </div>


                {/* Requested */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-navy-500
                    "
                  >
                    Requested Amount
                  </span>


                  <span
                    className="
                      font-semibold
                      text-navy-900
                    "
                  >
                    {formatCurrency(
                      latestAdvanceRequested
                    )}
                  </span>

                </div>


                {/* Approved */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-navy-500
                    "
                  >
                    Approved Amount
                  </span>


                  <span
                    className="
                      font-semibold
                      text-navy-900
                    "
                  >
                    {latestAdvance?.approvedAmount !==
                    null &&
                    latestAdvance?.approvedAmount !==
                    undefined
                      ? formatCurrency(
                          latestAdvanceApproved
                        )
                      : 'Not approved'}
                  </span>

                </div>


                {/* Paid */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-navy-500
                    "
                  >
                    Paid Amount
                  </span>


                  <span
                    className="
                      font-semibold
                      text-success-700
                    "
                  >
                    {latestAdvance?.paidAmount !==
                    null &&
                    latestAdvance?.paidAmount !==
                    undefined
                      ? formatCurrency(
                          latestAdvancePaid
                        )
                      : 'Not paid'}
                  </span>

                </div>


                {/* Request Date */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-navy-500
                    "
                  >
                    Request Date
                  </span>


                  <span
                    className="
                      font-medium
                      text-navy-800
                    "
                  >
                    {formatDate(
                      latestAdvance?.paymentDate
                    )}
                  </span>

                </div>


                {/* Reason */}

                <div
                  className="
                    rounded-lg
                    bg-navy-50
                    p-4
                  "
                >

                  <p
                    className="
                      text-xs
                      text-navy-400
                    "
                  >
                    Reason
                  </p>


                  <p
                    className="
                      mt-1
                      text-sm
                      text-navy-800
                    "
                  >
                    {latestAdvance?.reason ||
                      'No reason provided'}
                  </p>

                </div>

              </div>

            )}

          </div>


          {/* ==================================================
              QUICK OVERVIEW
          ================================================== */}

          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-3
              gap-4
            "
          >

            {/* ==================================================
                ATTENDANCE
            ================================================== */}

            <div
              className="
                card-hover
                p-5
              "
            >

              <CalendarCheck
                size={22}
                className="
                  text-accent-600
                  mb-2
                "
              />


              <p
                className="
                  font-medium
                  text-navy-900
                  text-sm
                "
              >
                My Attendance
              </p>


              <p
                className="
                  text-xs
                  text-navy-500
                  mt-1
                "
              >
                {present} present days,
                {' '}
                {absent} absent days
              </p>


              <p
                className="
                  text-xs
                  text-navy-500
                  mt-1
                "
              >
                {totalHours} total hours
              </p>

            </div>


            {/* ==================================================
                LEAVES
            ================================================== */}

            <div
              className="
                card-hover
                p-5
              "
            >

              <CalendarDays
                size={22}
                className="
                  text-success-600
                  mb-2
                "
              />


              <p
                className="
                  font-medium
                  text-navy-900
                  text-sm
                "
              >
                My Leaves
              </p>


              <p
                className="
                  text-xs
                  text-navy-500
                  mt-1
                "
              >
                Open My Leaves to view your
                leave requests and approvals.
              </p>

            </div>


            {/* ==================================================
                ADVANCES
            ================================================== */}

            <div
              className="
                card-hover
                p-5
              "
            >

              <Banknote
                size={22}
                className="
                  text-warning-600
                  mb-2
                "
              />


              <p
                className="
                  font-medium
                  text-navy-900
                  text-sm
                "
              >
                My Advances
              </p>


              <p
                className="
                  text-xs
                  text-navy-500
                  mt-1
                "
              >
                {advances.length}
                {' '}
                advance record
                {advances.length === 1
                  ? ''
                  : 's'}
              </p>


              {latestAdvance?.status && (

                <p
                  className="
                    text-xs
                    text-navy-500
                    mt-1
                  "
                >
                  Latest:
                  {' '}
                  {String(
                    latestAdvance.status
                  ).toUpperCase()}
                </p>

              )}

            </div>

          </div>

        </div>

      </div>

    </div>

  );
}