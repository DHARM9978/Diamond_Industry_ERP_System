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

  const [data, setData] = useState(null);

  const [totalAdvancePayment, setTotalAdvancePayment] =
    useState(0);

  const [totalPayrollAmount, setTotalPayrollAmount] =
    useState(0);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);


  // ==========================================================
  // LOAD DASHBOARD DATA
  // ==========================================================

  useEffect(() => {

    const loadDashboard = async () => {

      try {

        setLoading(true);
        setError(null);


        // ======================================================
        // DASHBOARD API
        // ======================================================

        const dashboardResponse =
          await reportService.dashboard();


        console.log(
          'Dashboard API response:',
          dashboardResponse
        );


        /*
         * The service layer may already unwrap the API response.
         *
         * Therefore support both:
         *
         * 1. dashboardResponse.data
         *
         * 2. dashboardResponse
         */

        const dashboardData =
          dashboardResponse?.data ??
          dashboardResponse;


        if (
          !dashboardData ||
          typeof dashboardData !== 'object'
        ) {

          throw new Error(
            'Dashboard data was not returned by the server'
          );

        }


        setData(dashboardData);


        // ======================================================
        // TOTAL ADVANCE PAYMENT
        // ======================================================

        try {

          const advanceResponse =
            await advanceService.list();


          console.log(
            'Advance API response:',
            advanceResponse
          );


          /*
           * Depending on apiServices.js, the response can be:
           *
           * [
           *   {
           *     amount: 5000
           *   }
           * ]
           *
           * OR:
           *
           * {
           *   data: [...]
           * }
           */

          const advances =
            Array.isArray(advanceResponse)
              ? advanceResponse
              : Array.isArray(advanceResponse?.data)
                ? advanceResponse.data
                : [];


          const advanceTotal =
            advances.reduce(
              (total, advance) => {

                const amount =
                  Number(
                    advance?.amount ??
                    advance?.advanceAmount ??
                    advance?.advance_amount ??
                    0
                  );


                return total + amount;

              },
              0
            );


          setTotalAdvancePayment(
            advanceTotal
          );

        } catch (advanceError) {

          console.error(
            'Advance data loading failed:',
            advanceError
          );


          /*
           * Do not break the dashboard if the
           * advance endpoint fails.
           */

          setTotalAdvancePayment(0);

        }


        // ======================================================
        // TOTAL PAYROLL AMOUNT
        // ======================================================

        try {

          const payrollResponse =
            await payrollService.list();


          console.log(
            'Payroll API response:',
            payrollResponse
          );


          const payrollRecords =
            Array.isArray(payrollResponse)
              ? payrollResponse
              : Array.isArray(payrollResponse?.data)
                ? payrollResponse.data
                : [];


          /*
           * Payroll records normally contain:
           *
           * basicSalary
           * advanceDeduction
           * netSalary
           */

          const payrollTotal =
            payrollRecords.reduce(
              (total, payroll) => {

                const netSalary =
                  Number(
                    payroll?.netSalary ??
                    payroll?.net_salary ??
                    0
                  );


                return total + netSalary;

              },
              0
            );


          /*
           * If payroll records are unavailable,
           * use the value already supplied by
           * the dashboard API.
           */

          if (
            payrollRecords.length === 0 &&
            dashboardData?.payroll?.totalNetSalary != null
          ) {

            setTotalPayrollAmount(
              Number(
                dashboardData.payroll.totalNetSalary
              )
            );

          } else {

            setTotalPayrollAmount(
              payrollTotal
            );

          }

        } catch (payrollError) {

          console.error(
            'Payroll data loading failed:',
            payrollError
          );


          /*
           * Dashboard API already provides totalNetSalary,
           * so use it as a fallback.
           */

          setTotalPayrollAmount(
            Number(
              dashboardData?.payroll?.totalNetSalary ?? 0
            )
          );

        }

      } catch (error) {

        console.error(
          'Dashboard loading failed:',
          error
        );


        setError(
          error?.message ||
          'Unable to load dashboard data'
        );

      } finally {

        setLoading(false);

      }

    };


    loadDashboard();

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

  const d = data;


  // ==========================================================
  // EMPLOYEES
  // ==========================================================

  const totalEmployees =
    Number(
      d?.employees?.total ?? 0
    );


  const activeEmployees =
    Number(
      d?.employees?.active ?? 0
    );


  // ==========================================================
  // TODAY'S ATTENDANCE
  // ==========================================================

  const presentToday =
    Number(
      d?.attendance?.today?.present ?? 0
    );


  const checkedOutToday =
    Number(
      d?.attendance?.today?.checkedOut ?? 0
    );


  const currentlyWorking =
    Number(
      d?.attendance?.today?.currentlyWorking ?? 0
    );


  const onLeaveToday =
    Number(
      d?.attendance?.today?.onLeave ?? 0
    );


  // ==========================================================
  // ABSENT TODAY
  // ==========================================================

  /*
   * Active Employees
   * - Present
   * - On Leave
   */

  const absentToday =
    Math.max(
      activeEmployees -
      presentToday -
      onLeaveToday,
      0
    );


  // ==========================================================
  // ATTENDANCE RATE
  // ==========================================================

  /*
   * Present / Active Employees × 100
   */

  const attendanceRate =
    activeEmployees > 0

      ? Number(
          (
            (presentToday /
              activeEmployees) *
            100
          ).toFixed(2)
        )

      : 0;


  // ==========================================================
  // LATE TODAY
  // ==========================================================

  /*
   * The current dashboard API does not provide
   * late-arrival information.
   *
   * Keep this at 0 until the backend exposes
   * the actual late calculation.
   */

  const lateToday = 0;


  // ==========================================================
  // PENDING LEAVES
  // ==========================================================

  const pendingLeaves =
    Number(
      d?.leave?.pendingRequests ?? 0
    );


  // ==========================================================
  // PENDING ADVANCES
  // ==========================================================

  const pendingAdvances =
    Number(
      d?.advances?.pendingRequests ?? 0
    );


  // ==========================================================
  // PENDING APPROVALS
  // ==========================================================

  const pendingApprovals =
    pendingLeaves +
    pendingAdvances;


  // ==========================================================
  // MONTHLY PAYROLL
  // ==========================================================

  const monthlyPayroll =
    Number(
      d?.payroll?.totalNetSalary ?? 0
    );


  // ==========================================================
  // CURRENCY FORMATTER
  // ==========================================================

  const formatCurrency = (value) => {

    return `₹${Number(
      value || 0
    ).toLocaleString('en-IN')}`;

  };


  // ==========================================================
  // RENDER DASHBOARD
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


          {/* ==================================================
              SUMMARY ITEMS
          ================================================== */}

          <div className="space-y-4">

            {/* ------------------------------------------------
                MONTHLY PAYROLL
            ------------------------------------------------ */}

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
                {formatCurrency(monthlyPayroll)}
              </span>

            </div>


            {/* ------------------------------------------------
                TOTAL ADVANCE PAYMENT
            ------------------------------------------------ */}

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


            {/* ------------------------------------------------
                TOTAL PAYROLL AMOUNT
            ------------------------------------------------ */}

            {/* <div
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

            </div> */}


            {/* ------------------------------------------------
                ATTENDANCE RATE
            ------------------------------------------------ */}

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


            {/* ------------------------------------------------
                PENDING APPROVALS
            ------------------------------------------------ */}

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


            {/* ------------------------------------------------
                TOTAL EMPLOYEES
            ------------------------------------------------ */}

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