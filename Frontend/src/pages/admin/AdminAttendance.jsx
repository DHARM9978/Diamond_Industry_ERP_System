import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarCheck,
  Download,
  Pencil,
  RefreshCw,
  Save,
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
// ADMIN ATTENDANCE
// ============================================================

export function AdminAttendance() {

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [dateFilter, setDateFilter] = useState('');

  const { toast } = useToast();

  const [editingRecord, setEditingRecord] = useState(null);
  const [checkoutTime, setCheckoutTime] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);


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
  //
  // The backend returns clock values as HH:mm:ss.
  // A missing checkout is rendered as --.
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
  // ATTENDANCE CORRECTION
  // ============================================================

  const openCheckoutCorrection = (record) => {
    setEditingRecord(record);

    if (record?.checkOutTime) {
      setCheckoutTime(
        String(record.checkOutTime).slice(0, 5)
      );
    } else {
      setCheckoutTime('');
    }
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
        'Checkout time corrected successfully.',
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
  // LOAD ATTENDANCE
  // ============================================================
  //
  // The backend now includes today's raw punch state in the
  // attendance response. That gives us:
  //
  //   IN punch only  -> check-in shown, check-out = --,
  //                    hours calculated up to current time.
  //
  //   IN + OUT       -> both times shown, completed hours shown.
  //
  // The polling below makes a newly scanned attendance record
  // appear automatically without a manual page refresh.
  // ============================================================

  const loadAttendance = async (
    showRefresh = false,
    showPageLoading = false
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      if (showPageLoading) {
        setLoading(true);
      }

      // ========================================================
      // SEND CURRENT FILTERS TO BACKEND
      // ========================================================
      //
      // Daily status filters are calculated by the backend so
      // Absent and On Leave can also be returned when no
      // Attendance row exists yet.
      // ========================================================

      const params = {
        page: 1,
        limit: 100,

        ...(dateFilter
          ? {
              date: dateFilter,
            }
          : {}),

        ...(statusFilter
          ? {
              status: statusFilter,
            }
          : {}),
      };


      const response =
        await attendanceService.list(params);


      console.log(
        'Attendance API response:',
        response
      );


      // ========================================================
      // EXTRACT DATA
      // ========================================================

      const apiData =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];


      // ========================================================
      // NORMALIZE
      // ========================================================

      const normalizedRecords =
        apiData.map((record) => {

          const firstName =
            record.employee?.firstName ||
            '';

          const lastName =
            record.employee?.lastName ||
            '';

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
              record.employee?.email ||
              '',

            employeeStatus:
              record.employee?.status ||
              '',

            date:
              record.date,

            checkInTime:
              record.checkInTime ||
              null,

            checkOutTime:
              record.checkOutTime ||
              null,

            totalHours:
              record.totalHours !== null &&
              record.totalHours !== undefined
                ? Number(
                    record.totalHours
                  )
                : null,

            status:
              record.status,

            attendanceStatus:
              record.attendanceStatus ||
              null,

            onLeave:
              record.onLeave === true,

            late:
              record.late === true,

            createdAt:
              record.createdAt,

            updatedAt:
              record.updatedAt,
          };
        });


      console.log(
        'Normalized attendance records:',
        normalizedRecords
      );


      setRecords(
        normalizedRecords
      );

    } catch (error) {

      console.error(
        'Failed to fetch attendance:',
        error
      );


      if (showPageLoading) {
        setRecords([]);
      }

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
  //
  // Reload when the date/status filter changes and continue to
  // refresh every five seconds so a new fingerprint punch appears
  // automatically.
  // ============================================================

  useEffect(() => {
    let mounted = true;


    const initialLoad = async () => {
      if (!mounted) {
        return;
      }

      await loadAttendance(
        false,
        true
      );
    };


    initialLoad();


    const intervalId =
      setInterval(() => {

        if (mounted) {
          loadAttendance(
            false,
            false
          );
        }

      }, 5000);


    return () => {
      mounted = false;
      clearInterval(intervalId);
    };

  }, [
    statusFilter,
    dateFilter,
  ]);


  // ============================================================
  // STATUS FILTER CHANGE
  // ============================================================
  //
  // Status is a daily concept. When the user selects a status
  // without a date, automatically use today's IST date so:
  // PRESENT / ABSENT / LATE / ON_LEAVE all refer to the
  // same working day.
  // ============================================================

  const handleStatusFilterChange = (
    value
  ) => {
    setStatusFilter(value);

    if (
      value &&
      !dateFilter
    ) {
      setDateFilter(
        getISTTodayString()
      );
    }
  };


  // ============================================================
  // FILTER RECORDS
  // ============================================================

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const searchValue =
        search.trim().toLowerCase();

      const matchSearch =
        !searchValue ||
        record.employeeName
          ?.toLowerCase()
          .includes(searchValue) ||
        String(record.employeeId)
          .toLowerCase()
          .includes(searchValue);

      const matchStatus =
        !statusFilter ||
        record.status === statusFilter;

      const matchDate =
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
    dateFilter,
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
      record.status || '',
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
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob(
      ['\uFEFF' + csvContent],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;

    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    link.download =
      `attendance_${today}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };


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
        subtitle={`${filtered.length} record${
          filtered.length !== 1
            ? 's'
            : ''
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


        <input
          type="date"
          className="input-field"
          value={dateFilter}
          onChange={(e) =>
            setDateFilter(e.target.value)
          }
        />

      </div>


      {/* ========================================================
          TABLE / EMPTY STATE
      ======================================================== */}

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No attendance records"
          message={
            records.length === 0
              ? 'No attendance records are available.'
              : 'No records match your filters. Try another status or date.'
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
                  className={`font-mono ${
                    record.checkInTime
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
                  className={`font-mono ${
                    record.checkOutTime
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
              render: (record) => {
                const hours =
                  Number(record.totalHours);

                return (
                  <span className="font-semibold text-navy-700">
                    {!Number.isNaN(hours) && hours > 0
                      ? `${hours.toFixed(2)}h`
                      : '--'}
                  </span>
                );
              },
            },

            {
              key: 'status',
              label: 'Status',
              align: 'center',
              render: (record) => (
                <StatusBadge
                  status={record.status}
                />
              ),
            },

            {
              key: 'actions',
              label: 'Actions',
              align: 'center',
              render: (record) => (
                record.checkInTime && !record.checkOutTime ? (
                  <button
                    type="button"
                    onClick={() =>
                      openCheckoutCorrection(record)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warning-300 bg-warning-50 px-3 py-1.5 text-xs font-semibold text-warning-800 hover:bg-warning-100"
                    title="Resolve missing checkout"
                  >
                    <Pencil size={14} />
                    Resolve
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
        title="Resolve Missing Checkout"
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
            <p className="mt-2 text-xs text-warning-700">
              Enter the actual checkout time recorded by the employee or confirmed by an administrator. The system will recalculate total hours.
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
              {savingCorrection ? 'Saving...' : 'Save Checkout'}
            </button>
          </div>

        </div>
      </Modal>

    </div>
  );
}