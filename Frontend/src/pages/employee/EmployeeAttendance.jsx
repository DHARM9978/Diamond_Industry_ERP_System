import { useEffect, useMemo, useState } from 'react';

import {
  CalendarCheck,
  CalendarDays,
  Clock,
  History,
  Hourglass,
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
// DATE HELPERS
// ============================================================

const getISTDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = {};

  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};


const pad2 = (value) =>
  String(value).padStart(2, '0');


const toDateKey = (year, month, day) =>
  `${year}-${pad2(month)}-${pad2(day)}`;


const getCurrentMonthRange = () => {
  const {
    year,
    month,
    day,
  } = getISTDateParts();

  return {
    year,
    month,
    from: toDateKey(year, month, 1),
    to: toDateKey(year, month, day),
  };
};


const getMonthRange = (year, month) => {
  const lastDay =
    new Date(
      Date.UTC(
        year,
        month,
        0
      )
    ).getUTCDate();

  return {
    from: toDateKey(year, month, 1),
    to: toDateKey(year, month, lastDay),
  };
};


const getPreviousMonth = (year, month) => {
  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
};


const formatMonthYear = (year, month) => {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(
    new Date(
      Date.UTC(year, month - 1, 1)
    )
  );
};


const getMonthOptions = () => {
  return Array.from(
    { length: 12 },
    (_, index) => {
      const month = index + 1;

      return {
        value: month,
        label: new Intl.DateTimeFormat(
          'en-IN',
          {
            month: 'long',
            timeZone: 'Asia/Kolkata',
          }
        ).format(
          new Date(
            Date.UTC(2026, index, 1)
          )
        ),
      };
    }
  );
};


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

    date.setHours(
      hours,
      minutes,
      0,
      0
    );

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

  if (
    wholeHours === 0 &&
    minutes === 0
  ) {
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
// NORMALIZE ATTENDANCE RECORD
// ============================================================

const normalizeAttendance = (attendanceData) => {
  if (!Array.isArray(attendanceData)) {
    return [];
  }

  return attendanceData.map((record) => ({
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

  const currentMonth = useMemo(
    () => getCurrentMonthRange(),
    []
  );

  const [selectedYear, setSelectedYear] = useState(
    currentMonth.year
  );

  const [selectedMonth, setSelectedMonth] = useState(
    currentMonth.month
  );

  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);


  // ============================================================
  // SELECTED MONTH RANGE
  // ============================================================

  const selectedRange = useMemo(() => {
    const isCurrentMonth =
      selectedYear === currentMonth.year &&
      selectedMonth === currentMonth.month;

    if (isCurrentMonth) {
      return {
        ...currentMonth,
        isCurrentMonth: true,
      };
    }

    const range = getMonthRange(
      selectedYear,
      selectedMonth
    );

    return {
      ...range,
      year: selectedYear,
      month: selectedMonth,
      isCurrentMonth: false,
    };
  }, [
    currentMonth,
    selectedYear,
    selectedMonth,
  ]);


  // ============================================================
  // LOAD SELECTED MONTH ATTENDANCE
  // ============================================================

  const loadAttendance = async (
    isInitialLoad = false
  ) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const [
        summaryResponse,
        attendanceResponse,
      ] = await Promise.all([
        selfService.attendanceSummary({
          from: selectedRange.from,
          to: selectedRange.to,
        }),
        selfService.attendance({
          from: selectedRange.from,
          to: selectedRange.to,
        }),
      ]);

      setSummary(
        summaryResponse || null
      );

      const attendanceData =
        Array.isArray(attendanceResponse)
          ? attendanceResponse
          : Array.isArray(attendanceResponse?.data)
            ? attendanceResponse.data
            : [];

      setRecords(
        normalizeAttendance(
          attendanceData
        )
      );

    } catch (error) {
      console.error(
        'Failed to load employee attendance:',
        error
      );

      setSummary(null);
      setRecords([]);

    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };


  // ============================================================
  // INITIAL LOAD + MONTH CHANGE
  // ============================================================

  useEffect(() => {
    loadAttendance(true);
  }, [
    selectedRange.from,
    selectedRange.to,
  ]);


  // ============================================================
  // CURRENT MONTH AUTO-REFRESH
  // ============================================================
  //
  // Only the current month is refreshed automatically. Historical
  // months are loaded when their filters change and remain static.
  // ============================================================

  useEffect(() => {
    if (!selectedRange.isCurrentMonth) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadAttendance(false);
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    selectedRange.from,
    selectedRange.to,
    selectedRange.isCurrentMonth,
  ]);


  // ============================================================
  // SORT RECORDS
  // ============================================================

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      String(b.date || '').localeCompare(
        String(a.date || '')
      )
    );
  }, [records]);


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

  const attendanceRate =
    totalDays > 0
      ? ((presentDays / totalDays) * 100).toFixed(1)
      : '0';

  const monthlyExpectedHours =
    Number(
      s?.monthlyHours?.expectedHours ?? 0
    );

  const monthlyCompletedHours =
    Number(
      s?.monthlyHours?.completedHours ??
      totalHours ??
      0
    );

  const pendingWorkingHours =
    Math.max(
      monthlyExpectedHours -
        monthlyCompletedHours,
      0
    );

  const expectedHoursDisplay =
    monthlyExpectedHours > 0
      ? formatHours(monthlyExpectedHours)
      : 'Not set';

  const completedHoursDisplay =
    formatHours(
      monthlyCompletedHours
    );

  const pendingHoursDisplay =
    monthlyExpectedHours > 0
      ? formatHours(
          pendingWorkingHours
        )
      : 'Not set';

  const selectedMonthLabel =
    formatMonthYear(
      selectedYear,
      selectedMonth
    );

  const monthOptions = useMemo(
    () => getMonthOptions(),
    []
  );

  const yearOptions = useMemo(() => {
    return Array.from(
      { length: 11 },
      (_, index) =>
        currentMonth.year - index
    );
  }, [currentMonth.year]);


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
  // UI
  // ============================================================

  return (
    <div className="space-y-6">

      <PageHeader
        title="My Attendance"
        subtitle={`${selectedMonthLabel} attendance`}
      />


      {/* ======================================================
          MONTH / YEAR FILTER
      ====================================================== */}

      <div className="card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">

          <div>
            <label
              htmlFor="attendance-month"
              className="mb-1.5 block text-xs font-medium text-navy-600"
            >
              Attendance Month
            </label>

            <select
              id="attendance-month"
              value={selectedMonth}
              onChange={(event) =>
                setSelectedMonth(
                  Number(event.target.value)
                )
              }
              className="h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-800 outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            >
              {monthOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>


          <div>
            <label
              htmlFor="attendance-year"
              className="mb-1.5 block text-xs font-medium text-navy-600"
            >
              Year
            </label>

            <select
              id="attendance-year"
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(
                  Number(event.target.value)
                )
              }
              className="h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-800 outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
            >
              {yearOptions.map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>
          </div>


          <div className="lg:col-span-2">
            <div className="rounded-lg border border-navy-100 bg-navy-50/60 px-4 py-2.5">
              <div className="text-xs font-medium text-navy-400">
                Selected Attendance Period
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-navy-800">
                  {selectedMonthLabel}
                </span>

                <span className="text-xs text-navy-400">
                  {selectedRange.from} → {selectedRange.to}
                </span>

                {selectedRange.isCurrentMonth && (
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                    Current Month
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>


      {/* ======================================================
          SINGLE ATTENDANCE SECTION
      ====================================================== */}

      <div className="card p-6">

        {/* Section heading */}

        <div className="mb-5 flex flex-col gap-1 border-b border-navy-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-navy-900">
              {selectedMonthLabel} Attendance
            </h3>

            <p className="text-sm text-navy-500">
              {selectedRange.isCurrentMonth
                ? 'Current month attendance, working hours, and daily records.'
                : 'Attendance, working hours, and daily records for the selected month.'}
            </p>
          </div>

          <span className="text-xs font-medium text-navy-400">
            {sortedRecords.length}{' '}
            {sortedRecords.length === 1
              ? 'record'
              : 'records'}
          </span>
        </div>


        {/* ====================================================
            WORKING HOURS
        ==================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          <StatCard
            icon={Clock}
            label="Monthly Hours To Work"
            value={expectedHoursDisplay}
            color="navy"
          />

          <StatCard
            icon={TrendingUp}
            label="Completed Monthly Hours"
            value={completedHoursDisplay}
            color="success"
          />

          <StatCard
            icon={Hourglass}
            label="Pending Working Hours"
            value={pendingHoursDisplay}
            color="accent"
          />

        </div>


        {/* ====================================================
            ATTENDANCE SUMMARY
        ==================================================== */}

        <div className="mt-5 rounded-xl border border-navy-100 bg-navy-50/50 p-4">

          <div className="mb-4 flex items-center gap-2">
            <CalendarDays
              size={17}
              className="text-navy-500"
            />

            <h4 className="font-semibold text-navy-900">
              Attendance Summary
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div>
              <span className="text-sm text-navy-500">
                Present Days
              </span>

              <p className="mt-1 text-xl font-semibold text-success-600">
                {presentDays}
              </p>
            </div>

            <div>
              <span className="text-sm text-navy-500">
                Absent Days
              </span>

              <p className="mt-1 text-xl font-semibold text-error-600">
                {absentDays}
              </p>
            </div>

            <div>
              <span className="text-sm text-navy-500">
                Attendance Rate
              </span>

              <p className="mt-1 text-xl font-semibold text-navy-900">
                {attendanceRate}%
              </p>
            </div>

          </div>
        </div>


        {/* ====================================================
            DAILY ATTENDANCE
        ==================================================== */}

        <div className="mt-5">

          <div className="mb-4 flex flex-col gap-1">
            <h4 className="font-semibold text-navy-900">
              Daily Attendance
            </h4>

            <p className="text-sm text-navy-500">
              Times and hours below come from the resolved Attendance records.
            </p>
          </div>

          {sortedRecords.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No attendance records"
              message={`No resolved attendance records are available for ${selectedMonthLabel}.`}
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
                      key={
                        record.attendanceId ||
                        record.date
                      }
                      className="border-b border-navy-50 last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-3 py-4 text-navy-700">
                        {formatDate(record.date)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 font-mono text-navy-700">
                        {formatTime(record.checkInTime)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 font-mono text-navy-700">
                        {formatTime(record.checkOutTime)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 font-semibold text-navy-700">
                        {formatHours(record.totalHours)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-4">
                        <StatusBadge
                          status={record.status}
                        />
                      </td>

                      <td className="min-w-[170px] px-3 py-4">
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

    </div>
  );
}
