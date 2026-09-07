import { useState, useEffect } from 'react';

import {
  CalendarCheck,
  Clock,
  TrendingUp,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

import { selfService } from '@/services/apiServices';


export function EmployeeAttendance() {

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);


  // ============================================================
  // LOAD EMPLOYEE ATTENDANCE SUMMARY
  // ============================================================

  useEffect(() => {

    const loadAttendanceSummary = async () => {

      try {

        setLoading(true);


        // ======================================================
        // REAL API
        //
        // GET /api/me/attendance/summary
        //
        // The service already unwraps:
        //
        // response.data.data
        // ======================================================

        const response =
          await selfService.attendanceSummary();


        console.log(
          'Employee Attendance Summary:',
          response
        );


        setSummary(response);

      } catch (error) {

        console.error(
          'Failed to load employee attendance summary:',
          error
        );


        // ======================================================
        // IMPORTANT:
        //
        // NO MOCK / DUMMY DATA
        // ======================================================

        setSummary(null);

      } finally {

        setLoading(false);

      }

    };


    loadAttendanceSummary();

  }, []);


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading your attendance..."
      />
    );

  }


  // ============================================================
  // API DATA
  // ============================================================

  const s = summary || {};


  // ============================================================
  // ATTENDANCE VALUES
  //
  // These names exactly match the backend response.
  // ============================================================

  const totalDays =
    Number(s?.totalDays ?? 0);


  const presentDays =
    Number(s?.presentDays ?? 0);


  const absentDays =
    Number(s?.absentDays ?? 0);


  const totalHours =
    Number(s?.totalHours ?? 0);


  const totalHoursFormatted =
    s?.totalHoursFormatted ||
    '0 minutes';


  const averageHours =
    Number(s?.averageHours ?? 0);


  const averageHoursFormatted =
    s?.averageHoursFormatted ||
    '0 minutes';


  // ============================================================
  // ATTENDANCE RATE
  //
  // The current API does not provide attendanceRate.
  //
  // Therefore calculate it from:
  //
  // presentDays / totalDays * 100
  // ============================================================

  const attendanceRate =
    totalDays > 0
      ? ((presentDays / totalDays) * 100).toFixed(1)
      : '0';


  // ============================================================
  // UI
  // ============================================================

  return (

    <div>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader
        title="My Attendance"
        subtitle="Your attendance summary"
      />


      {/* ======================================================
          ATTENDANCE SUMMARY
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">


        {/* ====================================================
            Present Days
        ==================================================== */}

        <StatCard
          icon={CalendarCheck}
          label="Present Days"
          value={presentDays}
          color="success"
        />


        {/* ====================================================
            Absent Days
        ==================================================== */}

        <StatCard
          icon={CalendarCheck}
          label="Absent Days"
          value={absentDays}
          color="error"
        />


        {/* ====================================================
            Attendance Rate
        ==================================================== */}

        <StatCard
          icon={TrendingUp}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          color="accent"
        />


        {/* ====================================================
            Total Hours
        ==================================================== */}

        <StatCard
          icon={Clock}
          label="Total Hours"
          value={totalHours}
          color="navy"
        />

      </div>


      {/* ======================================================
          ATTENDANCE DETAILS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


        {/* ====================================================
            Work Summary
        ==================================================== */}

        <div className="card p-6">

          <h3 className="font-semibold text-navy-900 mb-5">
            Attendance Summary
          </h3>


          <div className="space-y-4">


            {/* Total Days */}

            <div className="flex justify-between">

              <span className="text-navy-500">
                Total Days
              </span>

              <span className="font-medium text-navy-900">
                {totalDays}
              </span>

            </div>


            {/* Present */}

            <div className="flex justify-between">

              <span className="text-navy-500">
                Present Days
              </span>

              <span className="font-medium text-success-600">
                {presentDays}
              </span>

            </div>


            {/* Absent */}

            <div className="flex justify-between">

              <span className="text-navy-500">
                Absent Days
              </span>

              <span className="font-medium text-error-600">
                {absentDays}
              </span>

            </div>


            {/* Attendance Rate */}

            <div className="flex justify-between">

              <span className="text-navy-500">
                Attendance Rate
              </span>

              <span className="font-medium text-navy-900">
                {attendanceRate}%
              </span>

            </div>


            {/* Total Hours */}

            <div className="flex justify-between">

              <span className="text-navy-500">
                Total Hours
              </span>

              <span className="font-medium text-navy-900">
                {totalHoursFormatted}
              </span>

            </div>


            {/* Average Hours */}

            <div className="flex justify-between">

              <span className="text-navy-500">
                Average Hours
              </span>

              <span className="font-medium text-navy-900">
                {averageHoursFormatted}
              </span>

            </div>

          </div>

        </div>


        {/* ====================================================
            Attendance Records Placeholder
        ==================================================== */}

        <div className="card p-6">

          <h3 className="font-semibold text-navy-900 mb-5">
            Daily Attendance
          </h3>


          <EmptyState
            icon={CalendarCheck}
            title="Attendance records"
            message="Daily attendance records will appear here once the attendance records API is connected."
          />


          {/* ==================================================
              API PLACEHOLDER
          ==================================================

              Next API:

              GET /api/me/attendance

              This API will populate the daily attendance
              table with:

              - Date
              - Check In
              - Check Out
              - Total Hours
              - Status

          ================================================== */}

        </div>

      </div>

    </div>

  );

}