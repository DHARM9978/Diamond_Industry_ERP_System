import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  Download,
  Pencil,
  RefreshCw,
  Save,
  UserCheck,
  UserMinus,
  UserX,
  XCircle,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';

import { FullPageSpinner } from '@/components/ui/Spinner';

import { EmptyState } from '@/components/ui/EmptyState';

import { Modal } from '@/components/ui/Modal';

import { useToast } from '@/context/ToastContext';

import {
  SearchInput,
  Select,
} from '@/components/ui/Form';

import {
  attendanceService,
} from '@/services/apiServices';

// ============================================================
// GET TODAY'S DATE IN IST
// ============================================================

const getISTTodayString = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

// ============================================================
// DATE RANGE HELPERS
// ============================================================

const addDaysToDateString = (
  dateString,
  days,
) => {
  if (!dateString) {
    return '';
  }

  const [year, month, day] =
    dateString
      .split('-')
      .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(
    date.getUTCDate()).padStart(2, '0')}`;
};

const getCurrentMonthString = () => {
  return getISTTodayString().slice(0, 7);
};

const getMonthRange = (monthValue) => {
  if (
    !monthValue ||
    !/^\d{4}-\d{2}$/.test(monthValue)
  ) {
    const today = getISTTodayString();
    return {
      from: today,
      to: today,
    };
  }

  const [year, month] =
    monthValue
      .split('-')
      .map(Number);

  const firstDay =
    `${year}-${String(month).padStart(2, '0')}-01`;

  const lastDayDate = new Date(
    Date.UTC(
      year,
      month,
      0,
    ),
  );

  const lastDay =
    `${lastDayDate.getUTCFullYear()}-${String(
      lastDayDate.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(
      lastDayDate.getUTCDate(),
    ).padStart(2, '0')}`;

  return {
    from: firstDay,
    to: lastDay,
  };
};

const formatPeriodDate = (dateValue) => {
  if (!dateValue) {
    return '--';
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
};

// ============================================================
// FETCH ALL RANGE ATTENDANCE RECORDS
// ============================================================
//
// A monthly period can contain more than 100 attendance rows.
// The backend is paginated, so the admin page collects all pages
// for range views instead of silently showing only the first page.
// ============================================================

const fetchAttendanceRecords = async (
  params,
  fetchAllPages,
) => {
  const firstResponse =
    await attendanceService.list({
      ...params,
      page: 1,
      limit: 100,
    });

  const firstData =
    Array.isArray(firstResponse)
      ? firstResponse
      : Array.isArray(firstResponse?.data)
        ? firstResponse.data
        : [];

  if (!fetchAllPages) {
    return firstData;
  }

  const pagination =
    firstResponse?.pagination || null;

  const totalPages =
    Number(pagination?.totalPages) || 1;

  if (totalPages <= 1) {
    return firstData;
  }

  const allRecords = [
    ...firstData,
  ];

  for (
    let page = 2;
    page <= totalPages;
    page += 1
  ) {
    const response =
      await attendanceService.list({
        ...params,
        page,
        limit: 100,
      });

    const pageData =
      Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];

    allRecords.push(...pageData);
  }

  return allRecords;
};

// ============================================================
// ADMIN ATTENDANCE
// ============================================================

export function AdminAttendance() {

  const [records, setRecords] = useState([]);

  const [summaryData, setSummaryData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [viewMode, setViewMode] = useState('DAILY');

  const [dateFilter, setDateFilter] =
    useState(getISTTodayString());

  const [monthFilter, setMonthFilter] =
    useState(getCurrentMonthString());

  const { toast } = useToast();

  const [editingRecord, setEditingRecord] = useState(null);
  const [checkoutTime, setCheckoutTime] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  // ============================================================
  // SELECTED PERIOD
  // ============================================================

  const selectedPeriod = useMemo(() => {
    if (viewMode === 'DAILY') {
      const selectedDate =
        dateFilter || getISTTodayString();

      return {
        from: selectedDate,
        to: selectedDate,
        label: formatPeriodDate(selectedDate),
      };
    }

    if (viewMode === 'LAST_7_DAYS') {
      const endDate =
        dateFilter || getISTTodayString();
      const startDate =
        addDaysToDateString(endDate, -6);

      return {
        from: startDate,
        to: endDate,
        label: `${formatPeriodDate(startDate)} – ${formatPeriodDate(endDate)}`,
      };
    }

    const range =
      getMonthRange(monthFilter || getCurrentMonthString());

    const monthLabel = (() => {
      const date = new Date(`${range.from}T00:00:00`);

      if (Number.isNaN(date.getTime())) {
        return `${formatPeriodDate(range.from)} – ${formatPeriodDate(range.to)}`;
      }

      return date.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    })();

    return {
      from: range.from,
      to: range.to,
      label: monthLabel,
    };
  }, [
    viewMode,
    dateFilter,
    monthFilter,
  ]);

  const isRangeView =
    viewMode !== 'DAILY';

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return '--';
    }

    // Backend format: YYYY-MM-DD.
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

    return date.toLocaleDateString('en-GB', {
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
  // DATE FILTER VALUE
  // ============================================================

  const getDateForFilter = (dateValue) => {
    if (!dateValue) {
      return '';
    }

    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      return dateValue;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // ============================================================
  // FORMAT HOURS
  // ============================================================

  const formatHours = (hoursValue) => {
    const hours = Number(hoursValue);

    if (!Number.isFinite(hours) || hours <= 0) {
      return '--';
    }

    return `${hours.toFixed(2)}h`;
  };

  // ============================================================
  // HISTORICAL OPEN SESSION CHECK
  // ============================================================

  const isHistoricalPendingSettlement = (record) => {
    const recordDate =
      getDateForFilter(record?.date);

    const todayDate =
      getISTTodayString();

    return Boolean(
      recordDate &&
      recordDate < todayDate &&
      record?.hasOpenSession === true
    );
  };

  // ============================================================
  // ATTENDANCE CORRECTION
  // ============================================================

  const openCheckoutCorrection = (record) => {
    setEditingRecord(record);
    setCheckoutTime('');
  };

  const closeCheckoutCorrection = () => {
    setEditingRecord(null);
    setCheckoutTime('');
  };

  const saveCheckoutCorrection = async () => {
    if (!editingRecord?.attendanceId) {
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(checkoutTime)) {
      toast(
        'Please enter a valid checkout time.',
        'error'
      );
      return;
    }

    try {
      setSavingCorrection(true);

      await attendanceService.update(
        editingRecord.attendanceId,
        {
          checkOutTime: `${checkoutTime}:00`,
        }
      );

      toast(
        'Attendance hours settled successfully.',
        'success'
      );

      closeCheckoutCorrection();
      await loadAttendance(false, false);
    } catch (error) {
      console.error(
        'Failed to correct checkout:',
        error
      );

      toast(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to correct checkout time.',
        'error'
      );
    } finally {
      setSavingCorrection(false);
    }
  };

  // ============================================================
  // LOAD ATTENDANCE + SUMMARY
  // ============================================================

  const loadAttendance = async (
    showRefresh = false,
    showPageLoading = false,
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      if (showPageLoading) {
        setLoading(true);
      }

      const periodParams =
        viewMode === 'DAILY'
          ? {
            date: selectedPeriod.from,
          }
          : {
            from: selectedPeriod.from,
            to: selectedPeriod.to,
          };

      const listParams = {
        ...periodParams,
        ...(viewMode === 'DAILY' && statusFilter
          ? {
            status: statusFilter,
          }
          : {}),
      };

      const [
        summaryResponse,
        attendanceRecords,
      ] = await Promise.all([
        attendanceService.summary(
          periodParams
        ),
        fetchAttendanceRecords(
          listParams,
          isRangeView,
        ),
      ]);

      const normalizedRecords =
        attendanceRecords.map((record) => {
          const firstName =
            record.employee?.firstName || '';

          const lastName =
            record.employee?.lastName || '';

          const employeeName =
            `${firstName} ${lastName}`.trim();

          return {
            attendanceId:
              record.attendanceId,

            employeeId:
              record.employeeId,

            employeeName:
              employeeName ||
              `Employee ${record.employeeId}`,

            employeeEmail:
              record.employee?.email || '',

            employeeStatus:
              record.employee?.status || '',

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

            hasOpenSession:
              record.hasOpenSession === true,

            status:
              record.status,

            attendanceStatus:
              record.attendanceStatus || null,

            onLeave:
              record.onLeave === true,

            late:
              record.late === true,

            resolutionSource:
              record.resolutionSource || null,

            manualOverride:
              record.manualOverride === true,

            createdAt:
              record.createdAt,

            updatedAt:
              record.updatedAt,
          };
        });

      setRecords(
        normalizedRecords
      );

      setSummaryData(
        summaryResponse || null
      );

    } catch (error) {
      console.error(
        'Failed to fetch attendance summary:',
        error
      );

      if (showPageLoading) {
        setRecords([]);
        setSummaryData(null);
      }

      toast(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load attendance summary.',
        'error'
      );
    } finally {
      if (showPageLoading) {
        setLoading(false);
      }

      if (showRefresh) {
        setRefreshing(false);
      }
    }
  };

  // ============================================================
  // INITIAL LOAD + LIVE ATTENDANCE REFRESH
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const initialLoad = async () => {
      if (!mounted) {
        return;
      }

      await loadAttendance(
        false,
        true,
      );
    };

    initialLoad();

    // Keep the existing live 5-second refresh for Daily view.
    // Range summaries are intentionally refreshed manually to avoid
    // repeatedly loading a complete week/month from the backend.
    let intervalId = null;

    if (viewMode === 'DAILY') {
      intervalId = setInterval(() => {
        if (mounted) {
          loadAttendance(
            false,
            false,
          );
        }
      }, 5000);
    }

    return () => {
      mounted = false;

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    viewMode,
    dateFilter,
    monthFilter,
    statusFilter,
  ]);

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
  // DISPLAY STATUS
  // ============================================================

  const getRecordStatus = (record) => {
    if (
      viewMode === 'DAILY' &&
      record?.status
    ) {
      return record.status;
    }

    if (
      record?.status === 'ON_LEAVE'
    ) {
      return 'ON_LEAVE';
    }

    if (
      record?.checkInTime &&
      record?.late === true
    ) {
      return 'LATE';
    }

    if (record?.checkInTime) {
      const match =
        String(record.checkInTime).match(
          /^(\d{1,2}):(\d{2})/
        );

      if (match) {
        const checkInMinutes =
          Number(match[1]) * 60 +
          Number(match[2]);

        if (checkInMinutes > 9 * 60) {
          return 'LATE';
        }
      }

      return 'PRESENT';
    }

    return record?.status || 'ABSENT';
  };

  // ============================================================
  // VIEW MODE CHANGE
  // ============================================================

  const handleViewModeChange = (mode) => {
    setViewMode(mode);

    // Status filters are intentionally limited to Daily view because
    // the range attendance endpoint returns attendance rows rather than
    // a full employee-day roster with leave resolution for every date.
    if (mode !== 'DAILY') {
      setStatusFilter('');
    }

    if (
      mode !== 'MONTHLY' &&
      !dateFilter
    ) {
      setDateFilter(getISTTodayString());
    }
  };

  // ============================================================
  // STATUS FILTER CHANGE
  // ============================================================

  const handleStatusFilterChange = (
    value,
  ) => {
    setStatusFilter(value);

    if (
      value &&
      !dateFilter
    ) {
      setDateFilter(getISTTodayString());
    }
  };

  // ============================================================
  // FILTER RECORDS
  // ============================================================

  const filtered = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return records.filter((record) => {
      const matchSearch =
        !searchValue ||
        record.employeeName
          ?.toLowerCase()
          .includes(searchValue) ||
        String(record.employeeId)
          .toLowerCase()
          .includes(searchValue);

      const recordStatus =
        getRecordStatus(record);

      const matchStatus =
        !statusFilter ||
        recordStatus === statusFilter;

      const matchDate =
        viewMode !== 'DAILY' ||
        !dateFilter ||
        getDateForFilter(record.date) === dateFilter;

      return (
        matchSearch &&
        matchStatus &&
        matchDate
      );
    });
  }, [
    records,
    search,
    statusFilter,
    viewMode,
    dateFilter,
  ]);

  // ============================================================
  // FILTER EMPLOYEE SUMMARY
  // ============================================================

  const filteredEmployeeSummaries = useMemo(() => {
    const summaries =
      Array.isArray(summaryData?.employeeSummaries)
        ? summaryData.employeeSummaries
        : [];

    const searchValue =
      search.trim().toLowerCase();

    if (!searchValue) {
      return summaries;
    }

    return summaries.filter((employee) => {
      const employeeName =
        `${employee.firstName || ''} ${employee.lastName || ''}`
          .trim()
          .toLowerCase();

      return (
        employeeName.includes(searchValue) ||
        String(employee.employeeId)
          .toLowerCase()
          .includes(searchValue) ||
        (employee.email || '')
          .toLowerCase()
          .includes(searchValue)
      );
    });
  }, [
    summaryData,
    search,
  ]);

  // ============================================================
  // EXPORT CSV
  // ============================================================

  const handleExport = () => {
    if (filtered.length === 0) {
      alert(
        'No attendance records available to export.'
      );
      return;
    }

    const headers = [
      'Employee ID',
      'Employee Name',
      'Email',
      'Date',
      'Check In',
      'Check Out',
      'Total Hours',
      'Status',
      'Resolution Source',
      'Manual Override',
    ];

    const rows = filtered.map((record) => [
      record.employeeId,
      record.employeeName || '',
      record.employeeEmail || '',
      formatDate(record.date),
      formatTime(record.checkInTime),
      formatTime(record.checkOutTime),
      record.totalHours !== null &&
        record.totalHours !== undefined
        ? Number(record.totalHours).toFixed(2)
        : '',
      getRecordStatus(record),
      getResolutionSourceLabel(
        record.resolutionSource,
      ),
      record.manualOverride === true
        ? 'YES'
        : 'NO',
    ]);

    const escapeCsvValue = (value) => {
      if (
        value === null ||
        value === undefined
      ) {
        return '';
      }

      const stringValue = String(value);

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csvContent = [
      headers
        .map(escapeCsvValue)
        .join(','),

      ...rows.map((row) =>
        row
          .map(escapeCsvValue)
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob(
      ['\uFEFF' + csvContent],
      {
        type: 'text/csv;charset=utf-8;',
      },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;

    link.download =
      `attendance_${selectedPeriod.from}_${selectedPeriod.to}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // ============================================================
  // SUMMARY CARD DATA
  // ============================================================

  const summaryCards = [
    {
      label: 'Total Employees',
      value: summaryData?.totalEmployees ?? '--',
      icon: CalendarDays,
    },
    {
      label: 'Present',
      value: summaryData?.present ?? '--',
      icon: UserCheck,
    },
    {
      label: 'Absent',
      value: summaryData?.absent ?? '--',
      icon: UserX,
    },
    {
      label: 'Late',
      value: summaryData?.late ?? '--',
      icon: UserMinus,
    },
    {
      label: 'On Leave',
      value: summaryData?.onLeave ?? '--',
      icon: CalendarCheck,
    },
    {
      label: 'Total Hours',
      value:
        summaryData?.totalHoursFormatted ||
        (summaryData?.totalHours !== undefined
          ? formatHours(summaryData.totalHours)
          : '--'),
      icon: Clock3,
    },
  ];

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading attendance..."
      />
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div>

      <PageHeader
        title="Attendance"
        subtitle={`${selectedPeriod.label} · ${filtered.length} detail record${filtered.length !== 1 ? 's' : ''
          }`}
        actions={
          <div className="flex items-center gap-2">

            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                loadAttendance(true, false)
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={18}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <Download size={18} />
              Export
            </button>

          </div>
        }
      />

      {/* ========================================================
    VIEW MODE
======================================================== */}

      <div className="mb-5 rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">

          {[
            {
              value: 'DAILY',
              label: 'Daily',
            },
            {
              value: 'LAST_7_DAYS',
              label: 'Last 7 Days',
            },
            {
              value: 'MONTHLY',
              label: 'Monthly',
            },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                handleViewModeChange(item.value)
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${viewMode === item.value
                  ? 'bg-navy-900 text-white'
                  : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                }`}
            >
              {item.label}
            </button>
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-2">

            {viewMode === 'MONTHLY' ? (
              <input
                type="month"
                className="input-field"
                value={monthFilter}
                onChange={(event) =>
                  setMonthFilter(event.target.value)
                }
              />
            ) : (
              <input
                type="date"
                className="input-field"
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value)
                }
              />
            )}

          </div>

        </div>

        <p className="mt-2 px-1 text-xs text-navy-400">
          {viewMode === 'DAILY'
            ? 'Daily attendance for the selected date. The current day remains live and refreshes automatically.'
            : viewMode === 'LAST_7_DAYS'
              ? `Rolling 7-day attendance from ${formatPeriodDate(selectedPeriod.from)} to ${formatPeriodDate(selectedPeriod.to)}.`
              : `Monthly attendance for ${selectedPeriod.label}.`}
        </p>
      </div>

      {/* ========================================================
    SUMMARY CARDS
======================================================== */}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-navy-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-navy-900">
                    {card.value}
                  </p>
                </div>

                <div className="rounded-lg bg-navy-50 p-2.5 text-navy-600">
                  <Icon size={19} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================
    PERIOD SUMMARY
======================================================== */}

      <div className="mb-6 rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">
              Attendance Summary
            </p>
            <h2 className="mt-1 text-lg font-semibold text-navy-900">
              {selectedPeriod.label}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-navy-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-navy-400">
                Checked In
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-800">
                {summaryData?.checkedIn ?? '--'}
              </p>
            </div>

            <div className="rounded-lg bg-navy-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-navy-400">
                Checked Out
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-800">
                {summaryData?.checkedOut ?? '--'}
              </p>
            </div>

            {viewMode !== 'DAILY' && (
              <div className="rounded-lg bg-navy-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-navy-400">
                  Calendar Days
                </p>
                <p className="mt-1 text-sm font-semibold text-navy-800">
                  {summaryData?.calendarDays ?? '--'}
                </p>
              </div>
            )}

            {viewMode !== 'DAILY' && (
              <div className="rounded-lg bg-navy-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-navy-400">
                  Employee-Days
                </p>
                <p className="mt-1 text-sm font-semibold text-navy-800">
                  {summaryData?.totalEmployeeDays ?? '--'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
    EMPLOYEE SUMMARY FOR RANGE VIEWS
======================================================== */}

      {viewMode !== 'DAILY' && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                Employee Summary
              </p>
              <h2 className="text-lg font-semibold text-navy-900">
                Attendance totals by employee
              </h2>
            </div>

            <p className="text-xs text-navy-400">
              {filteredEmployeeSummaries.length} employee{filteredEmployeeSummaries.length !== 1 ? 's' : ''}
            </p>
          </div>

          {filteredEmployeeSummaries.length === 0 ? (
            <div className="rounded-xl border border-navy-100 bg-white p-6 text-center text-sm text-navy-500">
              No employees match the current search.
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'employee',
                  label: 'Employee',
                  render: (employee) => (
                    <div>
                      <span className="font-medium text-navy-900">
                        {`${employee.firstName || ''} ${employee.lastName || ''}`.trim() || `Employee ${employee.employeeId}`}
                      </span>
                      {employee.email && (
                        <div className="text-xs text-navy-400 mt-1">
                          {employee.email}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'presentDays',
                  label: 'Present',
                  align: 'center',
                  render: (employee) => employee.presentDays ?? 0,
                },
                {
                  key: 'absentDays',
                  label: 'Absent',
                  align: 'center',
                  render: (employee) => employee.absentDays ?? 0,
                },
                {
                  key: 'onLeaveDays',
                  label: 'Leave',
                  align: 'center',
                  render: (employee) => employee.onLeaveDays ?? 0,
                },
                {
                  key: 'lateDays',
                  label: 'Late',
                  align: 'center',
                  render: (employee) => employee.lateDays ?? 0,
                },
                {
                  key: 'checkedOutDays',
                  label: 'Checked Out',
                  align: 'center',
                  render: (employee) => employee.checkedOutDays ?? 0,
                },
                {
                  key: 'totalHours',
                  label: 'Total Hours',
                  align: 'right',
                  render: (employee) => (
                    <span className="font-semibold text-navy-700">
                      {employee.totalHoursFormatted || formatHours(employee.totalHours)}
                    </span>
                  ),
                },
                {
                  key: 'averageHours',
                  label: 'Avg / Present Day',
                  align: 'right',
                  render: (employee) => (
                    <span className="font-semibold text-navy-700">
                      {employee.averageHoursFormatted || formatHours(employee.averageHours)}
                    </span>
                  ),
                },
              ]}
              data={filteredEmployeeSummaries}
            />
          )}
        </div>
      )}

      {/* ========================================================
    FILTERS
======================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search employee..."
        />

        <Select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          placeholder="All Statuses"
          disabled={isRangeView}
          options={[
            {
              value: 'PRESENT',
              label: 'Present',
            },
            {
              value: 'ABSENT',
              label: 'Absent',
            },
            {
              value: 'LATE',
              label: 'Late',
            },
            {
              value: 'ON_LEAVE',
              label: 'On Leave',
            },
          ]}
        />

        <div className="flex items-center rounded-lg border border-navy-100 bg-navy-50 px-3 text-sm text-navy-500">
          <CalendarCheck size={16} className="mr-2 shrink-0" />
          <span>
            {selectedPeriod.label}
          </span>
        </div>

      </div>

      {isRangeView && (
        <p className="-mt-3 mb-5 text-xs text-navy-400">
          Status filtering is available in Daily view. Range views provide period-wide status counts in the summary above.
        </p>
      )}

      {/* ========================================================
    TABLE / EMPTY STATE
======================================================== */}

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No attendance records"
          message={
            records.length === 0
              ? 'No attendance records are available for this period.'
              : 'No records match your current search or filter.'
          }
        />
      ) : (
        <DataTable
          columns={[
            {
              key: 'employeeId',
              label: 'Emp ID',
              render: (record) => (
                <span className="font-mono text-xs font-semibold text-navy-600">
                  {record.employeeId}
                </span>
              ),
            },

            {
              key: 'employeeName',
              label: 'Employee',
              render: (record) => (
                <div>
                  <span className="font-medium text-navy-900">
                    {record.employeeName || '--'}
                  </span>

                  {record.employeeEmail && (
                    <div className="text-xs text-navy-400 mt-1">
                      {record.employeeEmail}
                    </div>
                  )}
                </div>
              ),
            },

            {
              key: 'date',
              label: 'Date',
              render: (record) => (
                <span className="text-navy-600">
                  {formatDate(record.date)}
                </span>
              ),
            },

            {
              key: 'checkInTime',
              label: 'Check In',
              align: 'center',
              render: (record) => (
                <span
                  className={`font-mono ${record.checkInTime
                      ? 'text-navy-700'
                      : 'text-navy-300'
                    }`}
                >
                  {formatTime(record.checkInTime)}
                </span>
              ),
            },

            {
              key: 'checkOutTime',
              label: 'Check Out',
              align: 'center',
              render: (record) => (
                <span
                  className={`font-mono ${record.checkOutTime
                      ? 'text-navy-700'
                      : 'text-navy-300'
                    }`}
                >
                  {formatTime(record.checkOutTime)}
                </span>
              ),
            },

            {
              key: 'totalHours',
              label: 'Hours',
              align: 'right',
              render: (record) => (
                <span className="font-semibold text-navy-700">
                  {formatHours(record.totalHours)}
                </span>
              ),
            },

            {
              key: 'resolutionSource',
              label: 'Resolution',
              align: 'center',
              render: (record) => (
                <div className="flex flex-col items-center gap-1">
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
                        Resolved at office close
                      </span>
                    )}
                </div>
              ),
            },

            {
              key: 'manualOverride',
              label: 'Override',
              align: 'center',
              render: (record) => (
                <span
                  className={
                    record.manualOverride
                      ? 'text-xs font-semibold text-accent-700'
                      : 'text-xs text-navy-300'
                  }
                >
                  {record.manualOverride
                    ? 'Yes'
                    : 'No'}
                </span>
              ),
            },

            {
              key: 'status',
              label: 'Status',
              align: 'center',
              render: (record) => (
                <StatusBadge
                  status={getRecordStatus(record)}
                />
              ),
            },

            {
              key: 'actions',
              label: 'Actions',
              align: 'center',
              render: (record) => (
                isHistoricalPendingSettlement(record) ? (
                  <button
                    type="button"
                    onClick={() =>
                      openCheckoutCorrection(record)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warning-300 bg-warning-50 px-3 py-1.5 text-xs font-semibold text-warning-800 hover:bg-warning-100"
                    title="Settle historical missing checkout"
                  >
                    <Pencil size={14} />
                    Settle
                  </button>
                ) : (
                  <span className="text-xs text-navy-300">--</span>
                )
              ),
            },
          ]}
          data={filtered}
        />
      )}

      <Modal
        open={Boolean(editingRecord)}
        onClose={closeCheckoutCorrection}
        title="Settle Missing Checkout"
        size="sm"
      >
        <div className="space-y-5">

          <div className="rounded-lg bg-warning-50 p-4">
            <p className="font-semibold text-warning-900">
              {editingRecord?.employeeName || 'Employee'}
            </p>
            <p className="mt-1 text-sm text-warning-800">
              {formatDate(editingRecord?.date)} · Check in {formatTime(editingRecord?.checkInTime)}
            </p>

            {editingRecord?.resolutionSource && (
              <p className="mt-1 text-xs text-warning-700">
                Current resolution: {getResolutionSourceLabel(editingRecord.resolutionSource)}
              </p>
            )}

            <p className="mt-2 text-xs text-warning-700">
              Enter the checkout time for the missing final session. The existing checkout shown in this row may belong to an earlier completed IN/OUT session and is not used as the settlement time. Completed sessions are preserved, and the system recalculates the full day from the fingerprint punches.
            </p>
          </div>

          <div>
            <label
              htmlFor="attendance-checkout-time"
              className="mb-1.5 block text-sm font-medium text-navy-700"
            >
              Checkout Time
            </label>

            <input
              id="attendance-checkout-time"
              type="time"
              value={checkoutTime}
              onChange={(event) =>
                setCheckoutTime(event.target.value)
              }
              className="input-field w-full"
              disabled={savingCorrection}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeCheckoutCorrection}
              disabled={savingCorrection}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <XCircle size={16} />
              Cancel
            </button>

            <button
              type="button"
              onClick={saveCheckoutCorrection}
              disabled={savingCorrection || !checkoutTime}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Save size={16} />
              {savingCorrection ? 'Settling...' : 'Settle Hours'}
            </button>
          </div>

        </div>
      </Modal>

    </div>
  );
}
