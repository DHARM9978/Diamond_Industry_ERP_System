import { useState, useEffect } from 'react';

import {
  Users,
  CalendarCheck,
  Clock,
  CalendarDays,
  UserCheck,
  UserX,
  Activity,
  TrendingUp,
  Banknote,
  Wallet,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import {
  FullPageSpinner,
} from '@/components/ui/Spinner';

import {
  reportService,
  advanceService,
  payrollService,
} from '@/services/apiServices';


export function AdminDashboard() {

  // ==========================================================
  // STATE
  // ==========================================================

  const [data, setData] =
    useState(null);

  const [totalAdvancePayment, setTotalAdvancePayment] =
    useState(0);

  const [totalPayrollAmount, setTotalPayrollAmount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);


  // ==========================================================
  // HELPER
  // ==========================================================

  const normalizeArrayResponse = (
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


  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  useEffect(() => {

    let mounted = true;


    const loadDashboard = async () => {

      try {

        setLoading(true);
        setError(null);


        // ======================================================
        // LOAD DASHBOARD + ADVANCES + PAYROLL
        //
        // These are independent APIs.
        // Failure of one should not destroy the whole dashboard.
        // ======================================================

        const results =
          await Promise.allSettled([

            reportService.dashboard(),

            advanceService.list(),

            payrollService.list(),

          ]);


        // ======================================================
        // DASHBOARD RESULT
        // ======================================================

        const dashboardResult =
          results[0];


        if (
          dashboardResult.status ===
          'fulfilled'
        ) {

          const dashboardResponse =
            dashboardResult.value;


          const dashboardData =
            dashboardResponse?.data ??
            dashboardResponse;


          if (
            dashboardData &&
            typeof dashboardData ===
            'object'
          ) {

            if (mounted) {

              setData(
                dashboardData
              );
            }

          } else {

            throw new Error(
              'Dashboard data was not returned by the server'
            );
          }

        } else {

          throw dashboardResult.reason ||
            new Error(
              'Unable to load dashboard data'
            );
        }


        // ======================================================
        // ADVANCE RESULT
        //
        // IMPORTANT:
        //
        // Dashboard "Total Advance Payment" represents the
        // actual amount paid to employees.
        //
        // Therefore:
        //
        // status === PAID
        // AND paidAmount != null
        //
        // We DO NOT use:
        //
        // amount
        //
        // because amount is the original employee request.
        // ======================================================

        const advanceResult =
          results[1];


        if (
          advanceResult.status ===
          'fulfilled'
        ) {

          const advances =
            normalizeArrayResponse(
              advanceResult.value
            );


          const paidAdvanceTotal =
            advances.reduce(
              (
                total,
                advance
              ) => {

                const status =
                  String(
                    advance?.status ||
                    ''
                  )
                    .trim()
                    .toUpperCase();


                if (
                  status !==
                  'PAID'
                ) {

                  return total;
                }


                const paidAmount =
                  Number(
                    advance?.paidAmount ??
                    advance?.paid_amount ??
                    0
                  );


                if (
                  !Number.isFinite(
                    paidAmount
                  ) ||
                  paidAmount <= 0
                ) {

                  return total;
                }


                return (
                  total +
                  paidAmount
                );

              },
              0
            );


          if (mounted) {

            setTotalAdvancePayment(
              Number(
                paidAdvanceTotal.toFixed(2)
              )
            );
          }

        } else {

          console.error(
            'Advance data loading failed:',
            advanceResult.reason
          );


          /*
           * Keep dashboard usable.
           *
           * We intentionally do not calculate advance totals
           * from requested or approved amounts.
           */

          if (mounted) {

            setTotalAdvancePayment(
              0
            );
          }
        }


        // ======================================================
        // PAYROLL RESULT
        //
        // Use actual payroll netSalary values.
        // ======================================================

        const payrollResult =
          results[2];


        if (
          payrollResult.status ===
          'fulfilled'
        ) {

          const payrollRecords =
            normalizeArrayResponse(
              payrollResult.value
            );


          const payrollTotal =
            payrollRecords.reduce(
              (
                total,
                payroll
              ) => {

                const netSalary =
                  Number(
                    payroll?.netSalary ??
                    payroll?.net_salary ??
                    0
                  );


                if (
                  !Number.isFinite(
                    netSalary
                  )
                ) {

                  return total;
                }


                return (
                  total +
                  netSalary
                );

              },
              0
            );


          if (mounted) {

            setTotalPayrollAmount(
              Number(
                payrollTotal.toFixed(2)
              )
            );
          }

        } else {

          console.error(
            'Payroll data loading failed:',
            payrollResult.reason
          );


          /*
           * The dashboard report also contains totalNetSalary.
           * Use that as a fallback.
           */

          const dashboardResponse =
            results[0]?.value;


          const dashboardData =
            dashboardResponse?.data ??
            dashboardResponse;


          if (mounted) {

            setTotalPayrollAmount(
              Number(
                dashboardData?.payroll?.totalNetSalary ??
                0
              )
            );
          }
        }

      } catch (dashboardError) {

        console.error(
          'Dashboard loading failed:',
          dashboardError
        );


        if (mounted) {

          setError(
            dashboardError?.message ||
            'Unable to load dashboard data'
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


  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading dashboard..."
      />
    );
  }


  // ==========================================================
  // ERROR STATE
  // ==========================================================

  if (error) {

    return (

      <div>

        <PageHeader
          title="Dashboard"
          subtitle="Overview of your diamond workforce operations"
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


  // ==========================================================
  // DASHBOARD DATA
  // ==========================================================

  const d =
    data || {};


  // ==========================================================
  // EMPLOYEES
  // ==========================================================

  const totalEmployees =
    Number(
      d?.employees?.total ??
      0
    );


  const activeEmployees =
    Number(
      d?.employees?.active ??
      0
    );


  // ==========================================================
  // TODAY ATTENDANCE
  // ==========================================================

  const presentToday =
    Number(
      d?.attendance?.today?.present ??
      0
    );


  const checkedOutToday =
    Number(
      d?.attendance?.today?.checkedOut ??
      0
    );


  const currentlyWorking =
    Number(
      d?.attendance?.today?.currentlyWorking ??
      0
    );


  const onLeaveToday =
    Number(
      d?.attendance?.today?.onLeave ??
      0
    );


  // ==========================================================
  // ABSENT TODAY
  //
  // Active Employees - Present - On Leave
  // ==========================================================

  const absentToday =
    Math.max(
      activeEmployees -
      presentToday -
      onLeaveToday,
      0
    );


  // ==========================================================
  // ATTENDANCE RATE
  //
  // Present / Active Employees × 100
  // ==========================================================

  const attendanceRate =
    activeEmployees > 0
      ? Number(
          (
            (
              presentToday /
              activeEmployees
            ) *
            100
          ).toFixed(2)
        )
      : 0;


  // ==========================================================
  // LATE TODAY
  // ==========================================================
  //
  // The current dashboard backend does not expose a separate
  // late-arrival count.
  //
  // Do not invent late-arrival information.
  //
  // ==========================================================

  const lateToday =
    0;


  // ==========================================================
  // PENDING LEAVES
  // ==========================================================

  const pendingLeaves =
    Number(
      d?.leave?.pendingRequests ??
      0
    );


  // ==========================================================
  // PENDING ADVANCES
  // ==========================================================

  const pendingAdvances =
    Number(
      d?.advances?.pendingRequests ??
      0
    );


  // ==========================================================
  // PENDING APPROVALS
  // ==========================================================

  const pendingApprovals =
    pendingLeaves +
    pendingAdvances;


  // ==========================================================
  // MONTHLY / PAYROLL SUMMARY
  // ==========================================================

  const monthlyPayroll =
    Number(
      d?.payroll?.totalNetSalary ??
      totalPayrollAmount ??
      0
    );


  // ==========================================================
  // CURRENCY FORMATTER
  // ==========================================================

  const formatCurrency = (
    value
  ) => {

    const numericValue =
      Number(value || 0);


    return `₹${numericValue.toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader
        title="Dashboard"
        subtitle="Overview of your diamond workforce operations"
      />


      {/* ======================================================
          FIRST ROW
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

        {/* TOTAL EMPLOYEES */}

        <StatCard
          icon={Users}
          label="Total Employees"
          value={totalEmployees}
          color="navy"
        />


        {/* PRESENT TODAY */}

        <StatCard
          icon={UserCheck}
          label="Present Today"
          value={presentToday}
          color="success"
        />


        {/* ABSENT TODAY */}

        <StatCard
          icon={UserX}
          label="Absent Today"
          value={absentToday}
          color="error"
        />


        {/* LATE TODAY */}

        <StatCard
          icon={Clock}
          label="Late Today"
          value={lateToday}
          color="warning"
        />

      </div>


      {/* ======================================================
          SECOND ROW
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

        {/* ON LEAVE TODAY */}

        <StatCard
          icon={CalendarDays}
          label="On Leave Today"
          value={onLeaveToday}
          color="accent"
        />


        {/* ATTENDANCE RATE */}

        <StatCard
          icon={CalendarCheck}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          color="success"
        />


        {/* PENDING LEAVES */}

        <StatCard
          icon={CalendarDays}
          label="Pending Leaves"
          value={pendingLeaves}
          color="warning"
        />


        {/* PENDING ADVANCES */}

        <StatCard
          icon={Banknote}
          label="Pending Advances"
          value={pendingAdvances}
          color="error"
        />

      </div>


      {/* ======================================================
          LOWER SECTION
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
            RECENT ACTIVITY
        ==================================================== */}

        <div
          className="
            lg:col-span-2
            card
            p-6
          "
        >

          {/* SECTION HEADER */}

          <div
            className="
              flex
              items-center
              gap-2
              mb-4
            "
          >

            <Activity
              size={20}
              className="text-navy-600"
            />


            <h3
              className="
                font-semibold
                text-navy-900
              "
            >
              Recent Activity
            </h3>

          </div>


          {/* ACTIVITY CONTENT */}

          <div className="space-y-3">

            <div
              className="
                p-4
                rounded-lg
                bg-navy-50
                text-sm
                text-navy-500
              "
            >

              No recent activity available.

            </div>

          </div>

        </div>


        {/* ====================================================
            MONTHLY SUMMARY
        ==================================================== */}

        <div
          className="
            card
            p-6
          "
        >

          {/* SECTION HEADER */}

          <div
            className="
              flex
              items-center
              gap-2
              mb-4
            "
          >

            <TrendingUp
              size={20}
              className="text-navy-600"
            />


            <h3
              className="
                font-semibold
                text-navy-900
              "
            >
              Monthly Summary
            </h3>

          </div>


          <div className="space-y-4">

            {/* ==================================================
                MONTHLY PAYROLL
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-navy-50
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
                  size={17}
                  className="text-navy-600"
                />


                <span
                  className="
                    text-sm
                    text-navy-600
                  "
                >
                  Monthly Payroll
                </span>

              </div>


              <span
                className="
                  font-bold
                  text-navy-900
                "
              >
                {formatCurrency(
                  monthlyPayroll
                )}
              </span>

            </div>


            {/* ==================================================
                TOTAL ADVANCE PAYMENT
            ==================================================
            
                IMPORTANT:
                This is actual PAID advance amount.
                
                It is NOT:
                - requested amount
                - approved amount
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-accent-50
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <Banknote
                  size={17}
                  className="text-accent-700"
                />


                <span
                  className="
                    text-sm
                    text-accent-700
                  "
                >
                  Total Advance Payment
                </span>

              </div>


              <span
                className="
                  font-bold
                  text-accent-800
                "
              >
                {formatCurrency(
                  totalAdvancePayment
                )}
              </span>

            </div>


            {/* ==================================================
                TOTAL PAYROLL AMOUNT
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-success-50
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
                  size={17}
                  className="text-success-700"
                />


                <span
                  className="
                    text-sm
                    text-success-700
                  "
                >
                  Total Payroll Amount
                </span>

              </div>


              <span
                className="
                  font-bold
                  text-success-800
                "
              >
                {formatCurrency(
                  totalPayrollAmount
                )}
              </span>

            </div>


            {/* ==================================================
                ATTENDANCE RATE
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-success-50
              "
            >

              <span
                className="
                  text-sm
                  text-success-700
                "
              >
                Attendance Rate
              </span>


              <span
                className="
                  font-bold
                  text-success-800
                "
              >
                {attendanceRate}%
              </span>

            </div>


            {/* ==================================================
                CURRENTLY WORKING
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-navy-50
              "
            >

              <span
                className="
                  text-sm
                  text-navy-600
                "
              >
                Currently Working
              </span>


              <span
                className="
                  font-bold
                  text-navy-900
                "
              >
                {currentlyWorking}
              </span>

            </div>


            {/* ==================================================
                CHECKED OUT TODAY
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-accent-50
              "
            >

              <span
                className="
                  text-sm
                  text-accent-700
                "
              >
                Checked Out Today
              </span>


              <span
                className="
                  font-bold
                  text-accent-800
                "
              >
                {checkedOutToday}
              </span>

            </div>


            {/* ==================================================
                PENDING APPROVALS
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-warning-50
              "
            >

              <span
                className="
                  text-sm
                  text-warning-700
                "
              >
                Pending Approvals
              </span>


              <span
                className="
                  font-bold
                  text-warning-800
                "
              >
                {pendingApprovals}
              </span>

            </div>


            {/* ==================================================
                TOTAL EMPLOYEES
            ================================================== */}

            <div
              className="
                flex
                items-center
                justify-between
                p-3
                rounded-lg
                bg-accent-50
              "
            >

              <span
                className="
                  text-sm
                  text-accent-700
                "
              >
                Total Employees
              </span>


              <span
                className="
                  font-bold
                  text-accent-800
                "
              >
                {totalEmployees}
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}