import { useEffect, useMemo, useState } from 'react';

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

import {
  PageHeader,
} from '@/components/ui/PageComponents';

import {
  FullPageSpinner,
} from '@/components/ui/Spinner';

import {
  branchService,
} from '@/services/apiServices';

import apiClient from '@/services/apiClient';


// ============================================================
// ADMIN PUBLIC HOLIDAYS
// ============================================================

export function AdminPublicHolidays() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [holidays, setHolidays] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [dailyWorkingHours, setDailyWorkingHours] = useState('8');
  const [isPaid, setIsPaid] = useState(true);

  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(
    String(currentYear)
  );

  const [filterBranchId, setFilterBranchId] = useState('ALL');

  const [selectedMonth, setSelectedMonth] = useState(
    String(
      selectedYear === String(currentYear)
        ? new Date().getMonth()
        : 0
    )
  );

  const [selectedCalendarDate, setSelectedCalendarDate] =
    useState(null);

  const [holidayView, setHolidayView] = useState('upcoming');

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');


  // ==========================================================
  // RESPONSE HELPERS
  // ==========================================================

  const unwrapResponse = (response) => {
    return (
      response?.data?.data ??
      response?.data ??
      response
    );
  };


  const getArray = (response) => {
    const data = unwrapResponse(response);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.records)) {
      return data.records;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.holidays)) {
      return data.holidays;
    }

    return [];
  };


  const getErrorMessage = (requestError, fallback) => {
    return (
      requestError?.response?.data?.message ||
      requestError?.response?.data?.error ||
      requestError?.message ||
      fallback
    );
  };


  // ==========================================================
  // DATE HELPERS
  // ==========================================================

  const getDateKey = (value) => {
    if (!value) {
      return null;
    }

    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return value;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  };


  const formatDateForDisplay = (value) => {
    const dateKey = getDateKey(value);

    if (!dateKey) {
      return '-';
    }

    const [year, month, day] = dateKey.split('-');

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };


  const getDateRange = (start, end) => {
    if (!start) {
      return [];
    }

    const finalEnd = end || start;

    if (finalEnd < start) {
      return [];
    }

    const dates = [];
    const cursor = new Date(`${start}T00:00:00`);
    const lastDate = new Date(`${finalEnd}T00:00:00`);

    while (cursor <= lastDate) {
      dates.push(
        [
          cursor.getFullYear(),
          String(cursor.getMonth() + 1).padStart(2, '0'),
          String(cursor.getDate()).padStart(2, '0'),
        ].join('-')
      );

      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  };


  // ==========================================================
  // BRANCH HELPERS
  // ==========================================================

  const getBranchName = (branchId) => {
    const branch = branches.find(
      (item) =>
        Number(item?.branchId) === Number(branchId)
    );

    return (
      branch?.branchName ||
      `Branch ${branchId ?? '-'}`
    );
  };


  // ==========================================================
  // LOAD BRANCHES
  // ==========================================================

  const loadBranches = async () => {
    setBranchesLoading(true);

    try {
      const response = await branchService.list();
      setBranches(getArray(response));
    } catch (requestError) {
      console.error(
        'Failed to load branches:',
        requestError
      );

      setError(
        getErrorMessage(
          requestError,
          'Failed to load branches.'
        )
      );
    } finally {
      setBranchesLoading(false);
    }
  };


  // ==========================================================
  // LOAD HOLIDAYS
  // ==========================================================

  const loadHolidays = async ({
    showSpinner = true,
  } = {}) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const params = {
        year: Number(selectedYear),
      };

      if (filterBranchId !== 'ALL') {
        params.branchId = Number(filterBranchId);
      }

      const response = await apiClient.get(
        '/api/holidays',
        { params }
      );

      setHolidays(getArray(response));
    } catch (requestError) {
      console.error(
        'Failed to load public holidays:',
        requestError
      );

      setError(
        getErrorMessage(
          requestError,
          'Failed to load public holidays.'
        )
      );
    } finally {
      if (showSpinner) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadBranches();
  }, []);


  useEffect(() => {
    loadHolidays();
  }, [selectedYear, filterBranchId]);


  useEffect(() => {
    const month =
      selectedYear === String(currentYear)
        ? new Date().getMonth()
        : 0;

    setSelectedMonth(String(month));
    setSelectedCalendarDate(null);
  }, [selectedYear, currentYear]);


  // ==========================================================
  // CALENDAR HELPERS
  // ==========================================================

  const calendarHolidayMap = useMemo(() => {
    const map = new Map();

    holidays.forEach((holiday) => {
      const dateKey =
        getDateKey(holiday?.holidayDate);

      if (!dateKey) {
        return;
      }

      const existing =
        map.get(dateKey) || [];

      existing.push(holiday);
      map.set(dateKey, existing);
    });

    return map;
  }, [holidays]);


  const calendarDays = useMemo(() => {
    const year = Number(selectedYear);
    const month = Number(selectedMonth);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return [];
    }

    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const totalCells = Math.ceil(
      (firstWeekday + daysInMonth) / 7
    ) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber =
        index - firstWeekday + 1;

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return null;
      }

      const dateKey = [
        year,
        String(month + 1).padStart(2, '0'),
        String(dayNumber).padStart(2, '0'),
      ].join('-');

      return {
        day: dayNumber,
        dateKey,
        holidays: calendarHolidayMap.get(dateKey) || [],
      };
    });
  }, [
    calendarHolidayMap,
    selectedMonth,
    selectedYear,
  ]);


  const selectedCalendarHolidays =
    selectedCalendarDate
      ? calendarHolidayMap.get(selectedCalendarDate) || []
      : [];


  const calendarMonthLabel = new Date(
    Number(selectedYear),
    Number(selectedMonth),
    1
  ).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });


  const goToPreviousMonth = () => {
    setSelectedMonth((current) =>
      String(Math.max(0, Number(current) - 1))
    );
    setSelectedCalendarDate(null);
  };


  const goToNextMonth = () => {
    setSelectedMonth((current) =>
      String(Math.min(11, Number(current) + 1))
    );
    setSelectedCalendarDate(null);
  };


  // ==========================================================
  // MODAL HELPERS
  // ==========================================================

  const clearMessages = () => {
    setMessage('');
    setError('');
  };


  const openCreateModal = () => {
    clearMessages();

    setEditingHoliday(null);

    setSelectedBranchId(
      filterBranchId !== 'ALL'
        ? String(filterBranchId)
        : ''
    );

    setStartDate('');
    setEndDate('');
    setHolidayName('');
    setDailyWorkingHours('8');
    setIsPaid(true);

    setShowModal(true);
  };


  const openEditModal = (holiday) => {
    clearMessages();

    const holidayDate =
      getDateKey(holiday?.holidayDate) || '';

    setEditingHoliday(holiday);

    setSelectedBranchId(
      String(
        holiday?.branchId ??
        holiday?.branch?.branchId ??
        ''
      )
    );

    setStartDate(holidayDate);
    setEndDate(holidayDate);

    setHolidayName(
      holiday?.holidayName || ''
    );

    setDailyWorkingHours(
      String(
        holiday?.dailyWorkingHours ?? 0
      )
    );

    setIsPaid(
      holiday?.isPaid !== false
    );

    setShowModal(true);
  };


  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingHoliday(null);
  };


  // ==========================================================
  // VALIDATION
  // ==========================================================

  const validateForm = () => {
    if (!selectedBranchId) {
      return 'Please select a branch or choose All Branches.';
    }

    if (
      selectedBranchId !== 'ALL' &&
      !branches.some(
        (branch) =>
          Number(branch?.branchId) ===
          Number(selectedBranchId)
      )
    ) {
      return 'The selected branch is not available.';
    }

    if (!startDate) {
      return 'Please select a holiday date.';
    }

    if (!editingHoliday && endDate && endDate < startDate) {
      return 'End date cannot be before start date.';
    }

    if (!holidayName.trim()) {
      return 'Please enter the holiday name.';
    }

    const hours = Number(dailyWorkingHours);

    if (
      !Number.isFinite(hours) ||
      hours < 0 ||
      hours > 24
    ) {
      return 'Daily working hours must be between 0 and 24.';
    }

    return null;
  };


  // ==========================================================
  // CREATE HOLIDAY(S)
  // ==========================================================

  const createHolidays = async () => {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const dates = getDateRange(
      startDate,
      endDate
    );

    if (dates.length === 0) {
      setError(
        'Please provide a valid holiday date range.'
      );
      return;
    }

    const branchIds =
      selectedBranchId === 'ALL'
        ? branches
            .map((branch) => Number(branch?.branchId))
            .filter((branchId) => Number.isInteger(branchId) && branchId > 0)
        : [Number(selectedBranchId)];

    if (branchIds.length === 0) {
      setError(
        'No branches are available. Please create a branch first.'
      );
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const failedRecords = [];
      let successfulCount = 0;

      for (const branchId of branchIds) {
        const branchName = getBranchName(branchId);

        for (const holidayDate of dates) {
          try {
            await apiClient.post(
              '/api/holidays',
              {
                branchId,
                holidayDate,
                holidayName: holidayName.trim(),
                dailyWorkingHours: Number(
                  dailyWorkingHours
                ),
                isPaid: Boolean(isPaid),
              }
            );

            successfulCount += 1;
          } catch (requestError) {
            failedRecords.push({
              branchName,
              date: holidayDate,
              message: getErrorMessage(
                requestError,
                'Failed to create holiday.'
              ),
            });
          }
        }
      }

      await loadHolidays({
        showSpinner: false,
      });

      const totalRecords =
        branchIds.length * dates.length;

      if (failedRecords.length > 0) {
        const failureSummary =
          failedRecords
            .slice(0, 10)
            .map(
              (item) =>
                `${item.branchName} - ${item.date}: ${item.message}`
            )
            .join(' | ');

        const moreFailures =
          failedRecords.length > 10
            ? ` | And ${failedRecords.length - 10} more failure(s).`
            : '';

        if (successfulCount > 0) {
          setMessage(
            `${successfulCount} of ${totalRecords} holiday record(s) created successfully.`
          );
        }

        setError(
          `${failedRecords.length} holiday record(s) could not be created: ` +
          `${failureSummary}${moreFailures}`
        );

        return;
      }

      if (selectedBranchId === 'ALL') {
        setMessage(
          `${dates.length} holiday date(s) applied to ` +
          `${branchIds.length} branch(es) successfully. ` +
          `${successfulCount} holiday record(s) created.`
        );
      } else {
        setMessage(
          dates.length === 1
            ? 'Public holiday added successfully.'
            : `${dates.length} public holidays added successfully.`
        );
      }

      setShowModal(false);
      setEditingHoliday(null);
    } catch (requestError) {
      console.error(
        'Failed to create public holiday:',
        requestError
      );

      setError(
        getErrorMessage(
          requestError,
          'Failed to create public holiday.'
        )
      );
    } finally {
      setSaving(false);
    }
  };


  // ==========================================================
  // UPDATE HOLIDAY
  // ==========================================================

  const updateHoliday = async () => {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!editingHoliday?.publicHolidayId) {
      setError(
        'The selected holiday could not be identified.'
      );
      return;
    }

    const editingHolidayDate =
      getDateKey(editingHoliday?.holidayDate) || '';

    if (editingHolidayDate && editingHolidayDate < todayKey) {
      setError(
        'Past public holidays are read-only and cannot be edited.'
      );
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      await apiClient.put(
        `/api/holidays/${editingHoliday.publicHolidayId}`,
        {
          branchId: Number(selectedBranchId),
          holidayDate: startDate,
          holidayName: holidayName.trim(),
          dailyWorkingHours: Number(
            dailyWorkingHours
          ),
          isPaid: Boolean(isPaid),
        }
      );

      await loadHolidays({
        showSpinner: false,
      });

      setMessage(
        'Public holiday updated successfully.'
      );

      setShowModal(false);
      setEditingHoliday(null);
    } catch (requestError) {
      console.error(
        'Failed to update public holiday:',
        requestError
      );

      setError(
        getErrorMessage(
          requestError,
          'Failed to update public holiday.'
        )
      );
    } finally {
      setSaving(false);
    }
  };


  const handleSave = async () => {
    if (editingHoliday) {
      await updateHoliday();
    } else {
      await createHolidays();
    }
  };


  // ==========================================================
  // DELETE HOLIDAY
  // ==========================================================

  const handleDelete = async (holiday) => {
    if (!holiday?.publicHolidayId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${holiday.holidayName || 'Public Holiday'}" on ${formatDateForDisplay(
        holiday.holidayDate
      )}?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      holiday.publicHolidayId
    );

    clearMessages();

    try {
      await apiClient.delete(
        `/api/holidays/${holiday.publicHolidayId}`
      );

      setMessage(
        'Public holiday deleted successfully.'
      );

      await loadHolidays({
        showSpinner: false,
      });
    } catch (requestError) {
      console.error(
        'Failed to delete public holiday:',
        requestError
      );

      setError(
        getErrorMessage(
          requestError,
          'Failed to delete public holiday.'
        )
      );
    } finally {
      setDeletingId(null);
    }
  };


  // ==========================================================
  // SORT
  // ==========================================================

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((first, second) => {
      const firstDate =
        getDateKey(first?.holidayDate) || '';

      const secondDate =
        getDateKey(second?.holidayDate) || '';

      if (firstDate !== secondDate) {
        return firstDate.localeCompare(secondDate);
      }

      return String(
        first?.holidayName || ''
      ).localeCompare(
        String(second?.holidayName || '')
      );
    });
  }, [holidays]);


  // ==========================================================
  // UPCOMING / PAST HOLIDAYS
  //
  // Today is treated as an upcoming/current holiday so that
  // today's record remains editable. Past dates are read-only.
  // ==========================================================

  const todayKey = (() => {
    const today = new Date();

    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
  })();


  const upcomingHolidays = useMemo(() => {
    return sortedHolidays.filter((holiday) => {
      const dateKey = getDateKey(holiday?.holidayDate) || '';
      return dateKey >= todayKey;
    });
  }, [sortedHolidays, todayKey]);


  const pastHolidays = useMemo(() => {
    return sortedHolidays
      .filter((holiday) => {
        const dateKey = getDateKey(holiday?.holidayDate) || '';
        return dateKey < todayKey;
      })
      .sort((first, second) => {
        const firstDate = getDateKey(first?.holidayDate) || '';
        const secondDate = getDateKey(second?.holidayDate) || '';
        return secondDate.localeCompare(firstDate);
      });
  }, [sortedHolidays, todayKey]);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading public holidays..."
      />
    );
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6">

      <PageHeader
        title="Public Holidays"
        subtitle="Manage branch-specific public holidays, paid holiday hours, and holiday dates."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            disabled={branchesLoading}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add Public Holiday
          </button>
        }
      />


      {/* ======================================================
          MESSAGES
      ======================================================= */}

      {message && (
        <div className="flex items-start gap-3 rounded-lg border border-success-200 bg-success-50 p-4 text-success-800">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />

          <p className="text-sm">
            {message}
          </p>
        </div>
      )}


      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-error-200 bg-error-50 p-4 text-error-800">
          <XCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <p className="text-sm break-words">
            {error}
          </p>
        </div>
      )}


      {/* ======================================================
          FILTERS / ACTIONS
      ======================================================= */}

      <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">
              Year
            </label>

            <select
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(event.target.value)
              }
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              {[0, 1, 2].map((offset) => {
                const year =
                  currentYear + offset;

                return (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                );
              })}
            </select>
          </div>


          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-700">
              Branch
            </label>

            <select
              value={filterBranchId}
              onChange={(event) =>
                setFilterBranchId(
                  event.target.value
                )
              }
              disabled={branchesLoading}
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              <option value="ALL">
                All Branches
              </option>

              {branches.map((branch) => (
                <option
                  key={branch.branchId}
                  value={branch.branchId}
                >
                  {branch.branchName}
                </option>
              ))}
            </select>
          </div>

        </div>


        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={() =>
              loadHolidays({
                showSpinner: false,
              })
            }
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>

        </div>

      </div>


      {/* ======================================================
          INFORMATION
      ======================================================= */}

      <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
        <div className="flex items-start gap-3">

          <CalendarDays
            size={20}
            className="mt-0.5 shrink-0 text-primary-600"
          />

          <div>
            <p className="font-semibold text-primary-800">
              Public holiday rules
            </p>

            <p className="mt-1 text-sm leading-6 text-primary-700">
              Public holidays are maintained separately
              for each branch. Paid holidays can contribute
              the configured daily working hours to payroll;
              unpaid holidays do not contribute working hours.
            </p>
          </div>

        </div>
      </div>


      {/* ======================================================
          UPCOMING / HISTORY / CALENDAR
      ======================================================= */}

      <section className="space-y-4">

        {/* SECTION SWITCHER */}
        <div className="card p-2.5">

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">

            <button
              type="button"
              onClick={() => setHolidayView('upcoming')}
              className={[
                'min-h-[68px] rounded-lg px-4 py-3 text-left transition-colors',
                holidayView === 'upcoming'
                  ? 'bg-navy-800 text-white shadow-sm'
                  : 'bg-white text-navy-700 hover:bg-navy-50',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    Upcoming Holidays
                  </p>
                  <p
                    className={
                      holidayView === 'upcoming'
                        ? 'mt-0.5 text-xs text-white/80'
                        : 'mt-0.5 text-xs text-navy-500'
                    }
                  >
                    Today and future dates
                  </p>
                </div>

                <span
                  className={
                    holidayView === 'upcoming'
                      ? 'rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white'
                      : 'rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700'
                  }
                >
                  {upcomingHolidays.length}
                </span>
              </div>
            </button>


            <button
              type="button"
              onClick={() => setHolidayView('history')}
              className={[
                'min-h-[68px] rounded-lg px-4 py-3 text-left transition-colors',
                holidayView === 'history'
                  ? 'bg-navy-800 text-white shadow-sm'
                  : 'bg-white text-navy-700 hover:bg-navy-50',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    Holiday History
                  </p>
                  <p
                    className={
                      holidayView === 'history'
                        ? 'mt-0.5 text-xs text-white/80'
                        : 'mt-0.5 text-xs text-navy-500'
                    }
                  >
                    Past dates — read only
                  </p>
                </div>

                <span
                  className={
                    holidayView === 'history'
                      ? 'rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white'
                      : 'rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-600'
                  }
                >
                  {pastHolidays.length}
                </span>
              </div>
            </button>


            <button
              type="button"
              onClick={() => setHolidayView('calendar')}
              className={[
                'min-h-[68px] rounded-lg px-4 py-3 text-left transition-colors',
                holidayView === 'calendar'
                  ? 'bg-navy-800 text-white shadow-sm'
                  : 'bg-white text-navy-700 hover:bg-navy-50',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    Holiday Calendar
                  </p>
                  <p
                    className={
                      holidayView === 'calendar'
                        ? 'mt-0.5 text-xs text-white/80'
                        : 'mt-0.5 text-xs text-navy-500'
                    }
                  >
                    View holidays by date
                  </p>
                </div>

                <span
                  className={
                    holidayView === 'calendar'
                      ? 'rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white'
                      : 'rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700'
                  }
                >
                  {holidays.length}
                </span>
              </div>
            </button>

          </div>

        </div>


        {/* ====================================================
            UPCOMING HOLIDAYS
        ===================================================== */}
        {holidayView === 'upcoming' && (
          <div className="space-y-3">

            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy-900">
                  Upcoming Holidays
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  Only current and future public holidays are shown here. They can be edited or deleted.
                </p>
              </div>

              <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
                {upcomingHolidays.length} record{upcomingHolidays.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="card overflow-hidden">
              {upcomingHolidays.length === 0 ? (
                <div className="p-10 text-center">
                  <CalendarDays
                    size={44}
                    className="mx-auto text-navy-300"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-navy-800">
                    No upcoming public holidays
                  </h3>
                  <p className="mt-1 text-sm text-navy-500">
                    There are no current or future public holidays for the selected filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-navy-100">
                    <thead className="bg-navy-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Date</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Holiday</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Branch</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Daily Hours</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Payment</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-navy-600">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-navy-100 bg-white">
                      {upcomingHolidays.map((holiday) => (
                        <tr
                          key={holiday.publicHolidayId}
                          className="hover:bg-navy-50/50"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-navy-800">
                            {formatDateForDisplay(holiday.holidayDate)}
                          </td>
                          <td className="px-5 py-4 text-sm text-navy-800">
                            {holiday.holidayName || '-'}
                          </td>
                          <td className="px-5 py-4 text-sm text-navy-700">
                            {holiday?.branch?.branchName || getBranchName(holiday.branchId)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-navy-700">
                            {Number(holiday.dailyWorkingHours ?? 0).toFixed(2)} hrs
                          </td>
                          <td className="px-5 py-4">
                            {holiday.isPaid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
                                <CheckCircle2 size={14} />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-600">
                                <XCircle size={14} />
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(holiday)}
                                className="inline-flex items-center gap-1 rounded-lg border border-navy-200 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
                              >
                                <Edit3 size={15} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(holiday)}
                                disabled={deletingId === holiday.publicHolidayId}
                                className="inline-flex items-center gap-1 rounded-lg border border-error-200 px-3 py-2 text-sm font-medium text-error-700 hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId === holiday.publicHolidayId ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                                Delete
                              </button>
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
        )}


        {/* ====================================================
            HOLIDAY HISTORY
        ===================================================== */}
        {holidayView === 'history' && (
          <div className="space-y-3">

            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy-900">
                  Holiday History
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  Past public holidays are preserved for reference and cannot be edited or deleted.
                </p>
              </div>

              <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-600">
                {pastHolidays.length} record{pastHolidays.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="card overflow-hidden">
              {pastHolidays.length === 0 ? (
                <div className="p-10 text-center">
                  <CalendarDays
                    size={44}
                    className="mx-auto text-navy-300"
                  />
                  <h3 className="mt-4 text-lg font-semibold text-navy-800">
                    No holiday history
                  </h3>
                  <p className="mt-1 text-sm text-navy-500">
                    No past public holidays exist for the selected filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-navy-100">
                    <thead className="bg-navy-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Date</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Holiday</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Branch</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Daily Hours</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">Payment</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-navy-600">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-navy-100 bg-white">
                      {pastHolidays.map((holiday) => (
                        <tr
                          key={holiday.publicHolidayId}
                          className="bg-navy-50/20"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-navy-600">
                            {formatDateForDisplay(holiday.holidayDate)}
                          </td>
                          <td className="px-5 py-4 text-sm text-navy-700">
                            {holiday.holidayName || '-'}
                          </td>
                          <td className="px-5 py-4 text-sm text-navy-600">
                            {holiday?.branch?.branchName || getBranchName(holiday.branchId)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-navy-600">
                            {Number(holiday.dailyWorkingHours ?? 0).toFixed(2)} hrs
                          </td>
                          <td className="px-5 py-4">
                            {holiday.isPaid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
                                <CheckCircle2 size={14} />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 px-3 py-1 text-xs font-semibold text-navy-500">
                                <XCircle size={14} />
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="inline-flex items-center rounded-full bg-navy-100 px-3 py-1 text-xs font-semibold text-navy-500">
                              Read Only
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}


        {/* ====================================================
            HOLIDAY CALENDAR
        ===================================================== */}
        {holidayView === 'calendar' && (
          <div className="space-y-4">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy-900">
                  Holiday Calendar
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  View all configured holiday dates for the selected year and branch filter.
                </p>
              </div>

              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                {holidays.length} total record{holidays.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="card mx-auto w-full max-w-3xl overflow-hidden">

              <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-navy-900">
                    Holiday Calendar
                  </p>
                  <p className="mt-0.5 text-[10px] text-navy-500">
                    {holidays.length} configured date{holidays.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousMonth}
                    disabled={Number(selectedMonth) === 0}
                    aria-label="Previous month"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="min-w-[128px] rounded-lg bg-navy-50 px-3 py-2 text-center">
                    <span className="text-xs font-semibold text-navy-700">
                      {calendarMonthLabel}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={goToNextMonth}
                    disabled={Number(selectedMonth) === 11}
                    aria-label="Next month"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-4">

                <div className="grid grid-cols-7 gap-1.5 text-[10px] font-bold uppercase tracking-wide text-navy-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="py-1.5 text-center">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((calendarDay, index) => {
                    if (!calendarDay) {
                      return (
                        <div
                          key={`calendar-empty-${index}`}
                          className="min-h-[68px] rounded-lg"
                        />
                      );
                    }

                    const isSelected =
                      selectedCalendarDate === calendarDay.dateKey;

                    const holidayCount =
                      calendarDay.holidays.length;

                    const isHoliday = holidayCount > 0;

                    return (
                      <button
                        key={calendarDay.dateKey}
                        type="button"
                        onClick={() =>
                          setSelectedCalendarDate(
                            isHoliday ? calendarDay.dateKey : null
                          )
                        }
                        className={[
                          'min-h-[68px] rounded-lg border p-2 text-left transition-all',
                          isHoliday
                            ? 'border-success-200 bg-success-50/70 hover:border-success-300 hover:bg-success-50'
                            : 'border-navy-100 bg-white hover:border-primary-200 hover:bg-primary-50/40',
                          isSelected
                            ? 'ring-2 ring-inset ring-primary-500'
                            : '',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={[
                              'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                              isHoliday
                                ? 'bg-success-100 text-success-800'
                                : 'bg-navy-50 text-navy-700',
                            ].join(' ')}
                          >
                            {calendarDay.day}
                          </span>

                          {holidayCount > 1 && (
                            <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-bold text-success-700 ring-1 ring-success-100">
                              {holidayCount}
                            </span>
                          )}
                        </div>

                        {isHoliday && (
                          <div className="mt-1.5 space-y-0.5">
                            {calendarDay.holidays.slice(0, 2).map((holiday) => (
                              <div
                                key={holiday.publicHolidayId}
                                className="flex min-w-0 items-center gap-1.5"
                                title={`${holiday.holidayName || 'Public Holiday'}${holiday.isPaid ? ' • Paid' : ' • Unpaid'}`}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
                                <span className="truncate text-[7px] font-semibold text-success-800">
                                  {holiday.holidayName || 'Public Holiday'}
                                </span>
                              </div>
                            ))}

                            {holidayCount > 2 && (
                              <div className="text-[8px] font-semibold text-primary-700">
                                +{holidayCount - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-navy-100 pt-3 text-[10px] text-navy-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-success-500" />
                    Public Holiday
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-navy-300" />
                    Regular Day
                  </span>
                  <span>
                    Click a date to view its holiday details.
                  </span>
                </div>

                {selectedCalendarDate && selectedCalendarHolidays.length > 0 && (
                  <div className="mt-3 rounded-lg border border-success-200 bg-success-50/60 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-success-700">
                          Selected Holiday Date
                        </p>
                        <p className="mt-1 text-sm font-bold text-success-900">
                          {formatDateForDisplay(selectedCalendarDate)}
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-success-700 ring-1 ring-success-100">
                        {selectedCalendarHolidays.length === 1
                          ? '1 holiday'
                          : `${selectedCalendarHolidays.length} holidays`}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedCalendarHolidays.map((holiday) => (
                        <div
                          key={holiday.publicHolidayId}
                          className="rounded-lg border border-success-100 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-navy-800">
                                {holiday.holidayName || 'Public Holiday'}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-navy-500">
                                {holiday?.branch?.branchName || getBranchName(holiday.branchId)}
                              </p>
                            </div>

                            {holiday.isPaid ? (
                              <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-[9px] font-bold text-success-700">
                                Paid
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[9px] font-bold text-navy-600">
                                Unpaid
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-[10px] text-navy-600">
                            Daily Hours:{' '}
                            <span className="font-bold">
                              {Number(holiday.dailyWorkingHours ?? 0).toFixed(2)} hrs
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        )}

      </section>


      {/* ======================================================
          CREATE / EDIT MODAL
      ======================================================= */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">

              <div>
                <h2 className="text-base font-bold text-navy-900">
                  {editingHoliday
                    ? 'Edit Public Holiday'
                    : 'Add Public Holiday'}
                </h2>

                <p className="mt-1 text-sm text-navy-500">
                  {editingHoliday
                    ? 'Change the holiday details or date.'
                    : 'Add one date or a consecutive range of public holidays.'}
                </p>
              </div>


              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-navy-500 hover:bg-navy-50 disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>


            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto space-y-5 px-6 py-5">

              {/* BRANCH */}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                  Branch
                  <span className="text-error-600"> *</span>
                </label>

                <select
                  value={selectedBranchId}
                  onChange={(event) =>
                    setSelectedBranchId(
                      event.target.value
                    )
                  }
                  disabled={
                    saving ||
                    branchesLoading
                  }
                  className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">
                    Select Branch
                  </option>

                  {!editingHoliday && (
                    <option value="ALL">
                      All Branches
                    </option>
                  )}

                  {branches.map((branch) => (
                    <option
                      key={branch.branchId}
                      value={branch.branchId}
                    >
                      {branch.branchName}
                    </option>
                  ))}
                </select>

                {!editingHoliday && (
                  <p className="mt-1.5 text-xs text-navy-500">
                    Choose All Branches to create the same holiday
                    for every branch in the company.
                  </p>
                )}
              </div>


              {/* DATES */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                    {editingHoliday
                      ? 'Date'
                      : 'Start Date'}
                    <span className="text-error-600"> *</span>
                  </label>

                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(
                        event.target.value
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </div>


                {!editingHoliday && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                      End Date
                    </label>

                    <input
                      type="date"
                      value={endDate}
                      min={
                        startDate ||
                        undefined
                      }
                      onChange={(event) =>
                        setEndDate(
                          event.target.value
                        )
                      }
                      disabled={saving}
                      className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                )}

              </div>


              {/* NAME */}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                  Holiday Name
                  <span className="text-error-600"> *</span>
                </label>

                <input
                  type="text"
                  value={holidayName}
                  onChange={(event) =>
                    setHolidayName(
                      event.target.value
                    )
                  }
                  placeholder="Example: Diwali"
                  maxLength={150}
                  disabled={saving}
                  className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>


              {/* HOURS / PAID */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                    Daily Working Hours
                    <span className="text-error-600"> *</span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    value={dailyWorkingHours}
                    onChange={(event) =>
                      setDailyWorkingHours(
                        event.target.value
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />

                  <p className="mt-1 text-xs text-navy-500">
                    Example: 8 hours
                  </p>
                </div>


                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                    Holiday Payment
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-navy-200 px-3 py-2.5">

                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(event) =>
                        setIsPaid(
                          event.target.checked
                        )
                      }
                      disabled={saving}
                      className="h-4 w-4 rounded border-navy-300 text-primary-600"
                    />

                    <span className="text-sm font-medium text-navy-700">
                      Paid Public Holiday
                    </span>

                  </label>
                </div>

              </div>


              {/* DATE PREVIEW */}

              {!editingHoliday &&
                startDate &&
                endDate &&
                getDateRange(
                  startDate,
                  endDate
                ).length > 1 && (
                  <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">

                    <p className="text-sm font-semibold text-primary-800">
                      Dates to be added
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">

                      {getDateRange(
                        startDate,
                        endDate
                      ).map((date) => (
                        <span
                          key={date}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-primary-700 shadow-sm"
                        >
                          {formatDateForDisplay(date)}
                        </span>
                      ))}

                    </div>

                  </div>
                )}

            </div>


            {/* FOOTER */}

            <div className="shrink-0 border-t border-navy-100 bg-white px-6 py-4">

              <div className="flex w-full items-center justify-between gap-4">

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={19} />
                  )}

                  {editingHoliday
                    ? 'Save Changes'
                    : 'Add Holiday'}
                </button>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex min-w-[150px] items-center justify-center rounded-xl border border-navy-200 bg-white px-6 py-3 text-base font-semibold text-navy-700 transition-colors hover:bg-navy-50 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


export default AdminPublicHolidays;
