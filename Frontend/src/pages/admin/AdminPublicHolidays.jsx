import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

import apiClient from '@/services/apiClient';
import { branchService } from '@/services/apiServices';

const getResponseData = (response) => {
  return response?.data?.data ?? response?.data ?? response;
};

const getArrayResponse = (response) => {
  const data = getResponseData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.holidays)) return data.holidays;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const getErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

const toDateKey = (value) => {
  if (!value) return '';

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const formatDate = (value) => {
  const key = toDateKey(value);

  if (!key) return '-';

  const [year, month, day] = key.split('-');

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
  if (!start) return [];

  const finalEnd = end || start;

  if (finalEnd < start) return [];

  const result = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${finalEnd}T00:00:00`);

  while (cursor <= last) {
    result.push(
      [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0'),
      ].join('-')
    );

    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};


const getBranchId = (holiday) => {
  return Number(
    holiday?.branchId ??
    holiday?.branch?.branchId ??
    0
  );
};

const getHolidaySignature = (holiday) => {
  return [
    String(holiday?.holidayName || '').trim().toLowerCase(),
    Number(holiday?.dailyWorkingHours ?? 0),
    Boolean(holiday?.isPaid),
  ].join('|');
};

const getBranchSignature = (records) => {
  return records
    .map((record) => getBranchId(record))
    .filter((id) => id > 0)
    .sort((a, b) => a - b)
    .join(',');
};

const isConsecutiveDate = (previousDate, currentDate) => {
  const previous = new Date(`${previousDate}T00:00:00`);
  const current = new Date(`${currentDate}T00:00:00`);

  previous.setDate(previous.getDate() + 1);

  return (
    previous.getFullYear() === current.getFullYear() &&
    previous.getMonth() === current.getMonth() &&
    previous.getDate() === current.getDate()
  );
};

const getDateRangeLabel = (startDate, endDate) => {
  if (!startDate) return '-';

  if (!endDate || startDate === endDate) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

const groupHolidayRecords = (records) => {
  const validRecords = [...records]
    .map((record) => ({
      ...record,
      _dateKey: toDateKey(record?.holidayDate),
      _branchId: getBranchId(record),
    }))
    .filter(
      (record) =>
        record._dateKey &&
        record._branchId > 0
    )
    .sort((a, b) => {
      if (a._branchId !== b._branchId) {
        return a._branchId - b._branchId;
      }

      if (a._dateKey !== b._dateKey) {
        return a._dateKey.localeCompare(b._dateKey);
      }

      return getHolidaySignature(a).localeCompare(
        getHolidaySignature(b)
      );
    });

  const result = [];

  for (const record of validRecords) {
    const last = result[result.length - 1];

    const canMerge =
      last &&
      last.branchId === record._branchId &&
      last.signature === getHolidaySignature(record) &&
      isConsecutiveDate(
        last.endDate,
        record._dateKey
      );

    if (canMerge) {
      last.endDate = record._dateKey;
      last.records.push(record);
      last.dayCount += 1;
      continue;
    }

    result.push({
      startDate: record._dateKey,
      endDate: record._dateKey,
      signature: getHolidaySignature(record),
      branchId: record._branchId,
      branchName: record?.branch?.branchName || null,
      holidayName: record?.holidayName || '-',
      dailyWorkingHours:
        record?.dailyWorkingHours ?? 0,
      isPaid: record?.isPaid !== false,
      dayCount: 1,
      records: [record],
    });
  }

  return result;
};


export function AdminPublicHolidays() {
  const currentYear = new Date().getFullYear();

  const [holidays, setHolidays] = useState([]);
  const [branches, setBranches] = useState([]);

  const [selectedYear, setSelectedYear] = useState(
    String(currentYear)
  );
  const [filterBranchId, setFilterBranchId] = useState('ALL');

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

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const branchName = (branchId) => {
    const branch = branches.find(
      (item) => Number(item?.branchId) === Number(branchId)
    );

    return branch?.branchName || `Branch ${branchId ?? '-'}`;
  };

  const loadBranches = async () => {
    setBranchesLoading(true);

    try {
      const response = await branchService.list();
      setBranches(getArrayResponse(response));
    } catch (requestError) {
      console.error('Failed to load branches:', requestError);
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

  const loadHolidays = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
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

      setHolidays(getArrayResponse(response));
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
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadHolidays();
  }, [selectedYear, filterBranchId]);

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

  const openEditModal = (holidayGroup) => {
    clearMessages();

    const records = Array.isArray(
      holidayGroup?.records
    )
      ? holidayGroup.records
      : [holidayGroup];

    const firstRecord = records[0];

    setEditingHoliday({
      ...holidayGroup,
      records,
      isGrouped: records.length > 1,
    });

    // Editing is always branch-specific. The branch is already known
    // from the row, so the administrator cannot accidentally update
    // another branch.
    setSelectedBranchId(
      String(
        holidayGroup?.branchId ??
        getBranchId(firstRecord)
      )
    );

    // IMPORTANT: both dates are loaded from the range row.
    setStartDate(
      holidayGroup?.startDate ||
      toDateKey(firstRecord?.holidayDate)
    );

    setEndDate(
      holidayGroup?.endDate ||
      toDateKey(firstRecord?.holidayDate)
    );

    setHolidayName(
      holidayGroup?.holidayName ||
      firstRecord?.holidayName ||
      ''
    );

    setDailyWorkingHours(
      String(
        holidayGroup?.dailyWorkingHours ??
        firstRecord?.dailyWorkingHours ??
        0
      )
    );

    setIsPaid(
      holidayGroup?.isPaid ??
      firstRecord?.isPaid !== false
    );

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingHoliday(null);
  };

  const validateForm = () => {
    if (!selectedBranchId) {
      return editingHoliday?.isGrouped
        ? 'Please select the branch you want to modify.'
        : 'Please select a branch or choose All Branches.';
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

    if (
      editingHoliday?.isGrouped &&
      !editingHoliday.records?.some(
        (record) =>
          getBranchId(record) ===
          Number(selectedBranchId)
      )
    ) {
      return 'The selected branch is not part of this holiday group.';
    }

    if (!startDate) {
      return 'Please select the holiday date.';
    }

    if (!endDate) {
      return 'Please select the end date.';
    }

    if (endDate < startDate) {
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

    if (!dates.length) {
      setError('Please provide a valid holiday date range.');
      return;
    }

    const branchIds =
      selectedBranchId === 'ALL'
        ? branches
            .map((branch) => Number(branch?.branchId))
            .filter(
              (id) => Number.isInteger(id) && id > 0
            )
        : [Number(selectedBranchId)];

    if (!branchIds.length) {
      setError(
        'No branches are available. Please create a branch first.'
      );
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const failed = [];
      let successful = 0;

      for (const branchId of branchIds) {
        for (const holidayDate of dates) {
          try {
            await apiClient.post('/api/holidays', {
              branchId,
              holidayDate,
              holidayName: holidayName.trim(),
              dailyWorkingHours: Number(
                dailyWorkingHours
              ),
              isPaid: Boolean(isPaid),
            });

            successful += 1;
          } catch (requestError) {
            failed.push({
              branchId,
              date: holidayDate,
              message: getErrorMessage(
                requestError,
                'Failed to create holiday.'
              ),
            });
          }
        }
      }

      await loadHolidays({ silent: true });

      const total =
        branchIds.length * dates.length;

      if (failed.length) {
        const summary = failed
          .slice(0, 8)
          .map(
            (item) =>
              `${branchName(item.branchId)} - ${item.date}: ${item.message}`
          )
          .join(' | ');

        if (successful) {
          setMessage(
            `${successful} of ${total} holiday record(s) created.`
          );
        }

        setError(
          `${failed.length} record(s) failed. ${summary}`
        );

        if (!successful) return;
      } else {
        setMessage(
          selectedBranchId === 'ALL'
            ? `${dates.length} holiday date(s) applied to ${branchIds.length} branch(es).`
            : dates.length === 1
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

  const updateHoliday = async () => {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const targetBranchId = Number(selectedBranchId);

    const existingRecords = Array.isArray(
      editingHoliday?.records
    )
      ? editingHoliday.records
      : [];

    if (!targetBranchId || !existingRecords.length) {
      setError(
        'The selected branch holiday could not be identified.'
      );
      return;
    }

    const newDates = getDateRange(
      startDate,
      endDate || startDate
    );

    if (!newDates.length) {
      setError(
        'Please provide a valid holiday date range.'
      );
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const existingByDate = new Map(
        existingRecords.map((record) => [
          toDateKey(record.holidayDate),
          record,
        ])
      );

      const newDateSet = new Set(newDates);

      /*
       * Keep the first existing record when possible. Then:
       * - update records whose dates remain in the range
       * - create dates newly added to the range
       * - delete records whose dates were removed from the range
       */
      const updates = [];
      const creates = [];
      const deletes = [];

      for (const date of newDates) {
        const existing = existingByDate.get(date);

        if (existing) {
          updates.push({
            id: existing.publicHolidayId,
            data: {
              branchId: targetBranchId,
              holidayDate: date,
              holidayName: holidayName.trim(),
              dailyWorkingHours: Number(
                dailyWorkingHours
              ),
              isPaid: Boolean(isPaid),
            },
          });
        } else {
          creates.push({
            branchId: targetBranchId,
            holidayDate: date,
            holidayName: holidayName.trim(),
            dailyWorkingHours: Number(
              dailyWorkingHours
            ),
            isPaid: Boolean(isPaid),
          });
        }
      }

      for (const record of existingRecords) {
        const oldDate = toDateKey(
          record.holidayDate
        );

        if (
          !newDateSet.has(oldDate) &&
          record.publicHolidayId
        ) {
          deletes.push(record.publicHolidayId);
        }
      }

      for (const item of updates) {
        await apiClient.put(
          `/api/holidays/${item.id}`,
          item.data
        );
      }

      for (const payload of creates) {
        await apiClient.post(
          '/api/holidays',
          payload
        );
      }

      for (const id of deletes) {
        await apiClient.delete(
          `/api/holidays/${id}`
        );
      }

      await loadHolidays({ silent: true });

      setMessage(
        `Public holiday updated for ${branchName(
          targetBranchId
        )}. Date range now contains ${
          newDates.length
        } day${newDates.length === 1 ? '' : 's'}.`
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
          'Failed to update public holiday range.'
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

  const handleDelete = async (holidayOrGroup) => {
    const records = Array.isArray(
      holidayOrGroup?.records
    )
      ? holidayOrGroup.records
      : [holidayOrGroup];

    const validRecords = records.filter(
      (record) => record?.publicHolidayId
    );

    if (!validRecords.length) return;

    const first = validRecords[0];

    const confirmed = window.confirm(
      validRecords.length === 1
        ? `Delete "${first.holidayName || 'Public Holiday'}" on ${formatDate(
            first.holidayDate
          )} for ${branchName(getBranchId(first))}?`
        : `Delete the complete ${validRecords.length}-day public holiday period for ${branchName(
            getBranchId(first)
          )}?`
    );

    if (!confirmed) return;

    setDeletingId(first.publicHolidayId);
    clearMessages();

    try {
      for (const record of validRecords) {
        await apiClient.delete(
          `/api/holidays/${record.publicHolidayId}`
        );
      }

      await loadHolidays({ silent: true });

      setMessage(
        validRecords.length === 1
          ? 'Public holiday deleted successfully.'
          : `The ${validRecords.length}-day public holiday period was deleted successfully.`
      );
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


  const groupedHolidays = useMemo(() => {
    return groupHolidayRecords(holidays);
  }, [holidays]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex items-center gap-3 text-navy-600">
          <Loader2
            size={22}
            className="animate-spin"
          />
          <span>Loading public holidays...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">
            Public Holidays
          </h1>
          <p className="mt-1 text-base text-navy-500">
            Manage branch-specific public holidays, paid holiday hours, and holiday dates.
          </p>
        </div>

        {/* ONLY ONE CREATE BUTTON */}
        <button
          type="button"
          onClick={openCreateModal}
          disabled={branchesLoading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          Add Public Holiday
        </button>
      </div>

      {/* MESSAGES */}
      {message && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />
          <p className="text-sm">{message}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <XCircle
            size={20}
            className="mt-0.5 shrink-0"
          />
          <p className="break-words text-sm">
            {error}
          </p>
        </div>
      )}

      {/* FILTERS */}
      <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(event.target.value)
                }
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy-700">
                Branch
              </label>
              <select
                value={filterBranchId}
                onChange={(event) =>
                  setFilterBranchId(event.target.value)
                }
                disabled={branchesLoading}
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

          <button
            type="button"
            onClick={() => loadHolidays({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? 'animate-spin' : ''
              }
            />
            Refresh
          </button>
        </div>
      </div>

      {/* INFORMATION */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <CalendarDays
            size={21}
            className="mt-0.5 shrink-0 text-blue-600"
          />
          <div>
            <p className="font-semibold text-blue-900">
              Public holiday rules
            </p>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Public holidays are maintained separately for each branch.
              Paid holidays contribute the configured daily working hours
              to payroll; unpaid holidays do not contribute working hours.
            </p>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
        {groupedHolidays.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays
              size={44}
              className="mx-auto text-navy-300"
            />
            <h3 className="mt-4 text-lg font-semibold text-navy-800">
              No public holidays
            </h3>
            <p className="mt-1 text-sm text-navy-500">
              No public holidays have been added for the selected year and branch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-navy-100">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Holiday
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Daily Hours
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Payment
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-navy-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-navy-100 bg-white">
                {groupedHolidays.map((holidayGroup) => (
                  <tr
                    key={`${holidayGroup.branchId}-${holidayGroup.startDate}-${holidayGroup.endDate}-${holidayGroup.signature}`}
                    className="hover:bg-navy-50/50"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-navy-800">
                      <div className="whitespace-nowrap">
                        {getDateRangeLabel(
                          holidayGroup.startDate,
                          holidayGroup.endDate
                        )}
                      </div>

                      <div className="mt-1 text-xs font-medium text-navy-500">
                        {holidayGroup.dayCount === 1
                          ? '1 day'
                          : `${holidayGroup.dayCount} days`}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-navy-800">
                      <div className="font-medium">
                        {holidayGroup.holidayName}
                      </div>

                      {holidayGroup.dayCount > 1 && (
                        <div className="mt-1 text-xs text-navy-500">
                          Consecutive holiday period
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm font-medium text-navy-700">
                      {branchName(
                        holidayGroup.branchId
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-navy-700">
                      {Number(
                        holidayGroup.dailyWorkingHours ?? 0
                      ).toFixed(2)}{' '}
                      hrs/day
                    </td>

                    <td className="px-5 py-4">
                      {holidayGroup.isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
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
                          onClick={() =>
                            openEditModal(
                              holidayGroup
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-navy-200 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
                        >
                          <Edit3 size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              holidayGroup
                            )
                          }
                          disabled={
                            deletingId ===
                            holidayGroup.records[0]
                              ?.publicHolidayId
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId ===
                          holidayGroup.records[0]
                            ?.publicHolidayId ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
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

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ maxHeight: '86vh' }}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-start justify-between border-b border-navy-100 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-navy-900">
                  {editingHoliday
                    ? editingHoliday.isGrouped
                      ? 'Edit Branch Public Holiday'
                      : 'Edit Public Holiday'
                    : 'Add Public Holiday'}
                </h2>

                <p className="mt-1 text-sm text-navy-500">
                  {editingHoliday
                    ? 'Change the branch holiday details or adjust its date range.'
                    : 'Add one date or a consecutive range of public holidays.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
                className="rounded-lg p-2 text-navy-500 transition hover:bg-navy-50 hover:text-navy-800 disabled:opacity-50"
              >
                <X size={23} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-5">
                {/* BRANCH */}
                <div>
                  <label className="mb-2 block text-base font-semibold text-navy-700">
                    Branch <span className="text-red-600">*</span>
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
                    className="w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-base text-navy-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      {editingHoliday?.isGrouped
                        ? 'Select Branch to Modify'
                        : 'Select Branch'}
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
                    <p className="mt-2 text-sm text-navy-500">
                      Choose All Branches to create the same holiday for every branch in the company.
                    </p>
                  )}

                  {editingHoliday && (
                    <p className="mt-2 text-sm text-blue-700">
                      You are editing only this branch. Other branch holidays
                      will not be changed.
                    </p>
                  )}
                </div>

                {/* DATES */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-base font-semibold text-navy-700">
                      Start Date{' '}
                      <span className="text-red-600">*</span>
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
                      className="w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-base text-navy-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-base font-semibold text-navy-700">
                      End Date{' '}
                      <span className="text-red-600">*</span>
                    </label>

                    <input
                      type="date"
                      value={endDate}
                      min={
                        startDate || undefined
                      }
                      onChange={(event) =>
                        setEndDate(
                          event.target.value
                        )
                      }
                      disabled={saving}
                      className="w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-base text-navy-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {editingHoliday && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                    You can increase or reduce the holiday duration by
                    changing the Start Date and End Date. Only the selected
                    branch will be updated.
                  </div>
                )}

                {/* HOLIDAY NAME */}
                <div>
                  <label className="mb-2 block text-base font-semibold text-navy-700">
                    Holiday Name{' '}
                    <span className="text-red-600">*</span>
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
                    className="w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-base text-navy-800 outline-none transition placeholder:text-navy-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* HOURS + PAYMENT */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-base font-semibold text-navy-700">
                      Daily Working Hours{' '}
                      <span className="text-red-600">*</span>
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
                      className="w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-base text-navy-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <p className="mt-1.5 text-sm text-navy-500">
                      Example: 8 hours
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-base font-semibold text-navy-700">
                      Holiday Payment
                    </label>

                    <label className="flex h-[50px] cursor-pointer items-center gap-3 rounded-lg border border-navy-200 px-4">
                      <input
                        type="checkbox"
                        checked={isPaid}
                        onChange={(event) =>
                          setIsPaid(
                            event.target.checked
                          )
                        }
                        disabled={saving}
                        className="h-5 w-5 accent-blue-600"
                      />

                      <span className="text-base font-medium text-navy-700">
                        Paid Public Holiday
                      </span>
                    </label>
                  </div>
                </div>

                {/* DATE PREVIEW */}
                {startDate &&
                  endDate &&
                  getDateRange(
                    startDate,
                    endDate
                  ).length > 1 && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900">
                        {editingHoliday
                          ? 'New holiday duration'
                          : 'Dates to be added'}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {getDateRange(
                          startDate,
                          endDate
                        ).map((date) => (
                          <span
                            key={date}
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm"
                          >
                            {formatDate(date)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="shrink-0 border-t border-navy-100 bg-white px-6 py-4">
              <div className="flex w-full items-center justify-between gap-4">
                {/* LEFT: SUBMIT */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex min-w-[165px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {saving ? (
                    <Loader2
                      size={19}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={20} />
                  )}

                  {editingHoliday
                    ? 'Update Holiday'
                    : 'Add Holiday'}
                </button>

                {/* RIGHT: CANCEL */}
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex min-w-[130px] items-center justify-center rounded-xl border border-navy-200 bg-white px-6 py-3 text-base font-semibold text-navy-700 transition hover:bg-navy-50 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
