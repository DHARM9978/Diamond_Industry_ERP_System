import { useEffect, useMemo, useState } from 'react';

import {
  CalendarCheck,
  Clock,
  TrendingUp,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

import { selfService } from '@/services/apiServices';


// ============================================================
// FORMAT DATE
// ============================================================

const formatDate = (dateValue) => {
  if (!dateValue) {
    return '--';
  }

  if (
    typeof dateValue === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
  ) {
    const [year, month, day] = dateValue.split('-');

    return `${day}/${month}/${year}`;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};


// ============================================================
// FORMAT TIME
// ============================================================

const formatTime = (timeValue) => {
  if (!timeValue) {
    return '--';
  }

  if (
    typeof timeValue === 'string' &&
    /^\d{2}:\d{2}(:\d{2})?$/.test(timeValue)
  ) {
    const [hours, minutes] = timeValue
      .split(':')
      .map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return '--';
    }

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const date = new Date(timeValue);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};


// ============================================================
// FORMAT HOURS
// ============================================================

const formatHours = (hoursValue) => {
  if (
    hoursValue === null ||
    hoursValue === undefined ||
    hoursValue === ''
  ) {
    return '--';
  }

  const hours = Number(hoursValue);

  if (Number.isNaN(hours)) {
    return '--';
  }

  const wholeHours = Math.floor(hours);
  const minutes = Math.round(
    (hours - wholeHours) * 60
  );

  if (wholeHours === 0 && minutes === 0) {
    return '0m';
  }

  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${wholeHours}h`;
  }

  return `${wholeHours}h ${minutes}m`;
};


// ============================================================
// RESOLUTION SOURCE DISPLAY
// ============================================================

const getResolutionSourceLabel = (source) => {
  switch (source) {
    case 'DEVICE':
      return 'Device';

    case 'AUTO_CLOSE':
      return 'Auto Close';

    case 'ADMIN':
      return 'Admin Override';

    default:
      return 'Open';
  }
};


const getResolutionSourceClass = (source) => {
  switch (source) {
    case 'DEVICE':
      return 'inline-flex items-center rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700';

    case 'AUTO_CLOSE':
      return 'inline-flex items-center rounded-full bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-800';

    case 'ADMIN':
      return 'inline-flex items-center rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700';

    default:
      return 'inline-flex items-center rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-500';
  }
};


// ============================================================
// EMPLOYEE ATTENDANCE
// ============================================================

export function EmployeeAttendance() {

  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);


  // ============================================================
  // LOAD SUMMARY + RESOLVED ATTENDANCE
  // ============================================================

  const loadAttendance = async () => {
    try {
      const [
        summaryResponse,
        attendanceResponse,
      ] = await Promise.all([
        selfService.attendanceSummary(),
        selfService.attendance(),
      ]);

      setSummary(summaryResponse || null);

      const attendanceData =
        Array.isArray(attendanceResponse)
          ? attendanceResponse
          : Array.isArray(attendanceResponse?.data)
            ? attendanceResponse.data
            : [];

      const normalizedRecords =
        attendanceData.map((record) => ({
          attendanceId:
            record.attendanceId,

          date:
            record.date,

          checkInTime:
            record.checkInTime || null,

          checkOutTime:
            record.checkOutTime || null,

          totalHours:
            record.totalHours !== null &&
            record.totalHours !== undefined
              ? Number(record.totalHours)
              : null,

          status:
            record.status || 'ABSENT',

          resolutionSource:
            record.resolutionSource || null,

          manualOverride:
            record.manualOverride === true,
        }));

      setRecords(normalizedRecords);

    } catch (error) {
      console.error(
        'Failed to load employee attendance:',
        error
      );

      // Never fall back to mock/dummy attendance.
      setSummary(null);
      setRecords([]);

    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // INITIAL LOAD + READ-ONLY REFRESH
  // ============================================================
  //
  // This refresh only reads resolved attendance. It does not
  // calculate or close attendance in the browser.
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) {
        return;
      }

      await loadAttendance();
    };

    run();

    const intervalId =
      setInterval(() => {
        if (mounted) {
          loadAttendance();
        }
      }, 10000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
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
  // API SUMMARY VALUES
  // ============================================================

  const s = summary || {};

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
    formatHours(totalHours);

  const averageHours =
    Number(s?.averageHours ?? 0);

  const averageHoursFormatted =
    s?.averageHoursFormatted ||
    formatHours(averageHours);

  const attendanceRate =
    totalDays > 0
      ? ((presentDays / totalDays) * 100).toFixed(1)
      : '0';


  // ============================================================
  // FILTER / SORT RESOLVED RECORDS
  // ============================================================

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const aTime =
        new Date(a.date).getTime();

      const bTime =
        new Date(b.date).getTime();

      return bTime - aTime;
    });
  }, [records]);


  // ============================================================
  // UI
  // ============================================================

  return (
    <div>

      <PageHeader
        title="My Attendance"
        subtitle="Your resolved attendance records"
      />


      {/* ======================================================
          ATTENDANCE SUMMARY
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <StatCard
          icon={CalendarCheck}
          label="Present Days"
          value={presentDays}
          color="success"
        />

        <StatCard
          icon={CalendarCheck}
          label="Absent Days"
          value={absentDays}
          color="error"
        />

        <StatCard
          icon={TrendingUp}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          color="accent"
        />

        <StatCard
          icon={Clock}
          label="Total Hours"
          value={totalHours}
          color="navy"
        />

      </div>


      {/* ======================================================
          ATTENDANCE SUMMARY DETAILS
      ====================================================== */}

      <div className="card p-6 mb-6">

        <h3 className="font-semibold text-navy-900 mb-5">
          Attendance Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <div>
            <span className="text-sm text-navy-500">
              Total Days
            </span>
            <p className="mt-1 font-semibold text-navy-900">
              {totalDays}
            </p>
          </div>

          <div>
            <span className="text-sm text-navy-500">
              Present Days
            </span>
            <p className="mt-1 font-semibold text-success-600">
              {presentDays}
            </p>
          </div>

          <div>
            <span className="text-sm text-navy-500">
              Absent Days
            </span>
            <p className="mt-1 font-semibold text-error-600">
              {absentDays}
            </p>
          </div>

          <div>
            <span className="text-sm text-navy-500">
              Attendance Rate
            </span>
            <p className="mt-1 font-semibold text-navy-900">
              {attendanceRate}%
            </p>
          </div>

          <div>
            <span className="text-sm text-navy-500">
              Total Hours
            </span>
            <p className="mt-1 font-semibold text-navy-900">
              {totalHoursFormatted}
            </p>
          </div>

          <div>
            <span className="text-sm text-navy-500">
              Average Hours
            </span>
            <p className="mt-1 font-semibold text-navy-900">
              {averageHoursFormatted}
            </p>
          </div>

        </div>
      </div>


      {/* ======================================================
          DAILY RESOLVED ATTENDANCE
      ====================================================== */}

      <div className="card p-6">

        <div className="flex flex-col gap-1 mb-5">
          <h3 className="font-semibold text-navy-900">
            Daily Attendance
          </h3>

          <p className="text-sm text-navy-500">
            Times and hours below come from the resolved Attendance record.
          </p>
        </div>

        {sortedRecords.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records"
            message="No resolved attendance records are available yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left">
                  <th className="px-3 py-3 font-semibold text-navy-600">
                    Date
                  </th>
                  <th className="px-3 py-3 font-semibold text-navy-600">
                    Check In
                  </th>
                  <th className="px-3 py-3 font-semibold text-navy-600">
                    Check Out
                  </th>
                  <th className="px-3 py-3 font-semibold text-navy-600">
                    Hours
                  </th>
                  <th className="px-3 py-3 font-semibold text-navy-600">
                    Status
                  </th>
                  <th className="px-3 py-3 font-semibold text-navy-600">
                    Resolution
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRecords.map((record) => (
                  <tr
                    key={record.attendanceId || record.date}
                    className="border-b border-navy-50 last:border-b-0"
                  >
                    <td className="px-3 py-4 text-navy-700 whitespace-nowrap">
                      {formatDate(record.date)}
                    </td>

                    <td className="px-3 py-4 font-mono text-navy-700 whitespace-nowrap">
                      {formatTime(record.checkInTime)}
                    </td>

                    <td className="px-3 py-4 font-mono text-navy-700 whitespace-nowrap">
                      {formatTime(record.checkOutTime)}
                    </td>

                    <td className="px-3 py-4 font-semibold text-navy-700 whitespace-nowrap">
                      {formatHours(record.totalHours)}
                    </td>

                    <td className="px-3 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={record.status}
                      />
                    </td>

                    <td className="px-3 py-4 min-w-[170px]">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={
                            getResolutionSourceClass(
                              record.resolutionSource
                            )
                          }
                        >
                          {getResolutionSourceLabel(
                            record.resolutionSource
                          )}
                        </span>

                        {record.resolutionSource ===
                          'AUTO_CLOSE' && (
                          <span className="text-[11px] text-warning-700">
                            Resolved at office close. The displayed checkout is not presented as a fingerprint scan.
                          </span>
                        )}

                        {record.resolutionSource ===
                          'ADMIN' && (
                          <span className="text-[11px] text-accent-700">
                            Administrator correction applied to Attendance.
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
