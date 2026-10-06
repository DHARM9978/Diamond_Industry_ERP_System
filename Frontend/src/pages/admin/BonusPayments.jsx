import { useEffect, useMemo, useState } from 'react';

import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Wallet,
  XCircle,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';

import { bonusService } from '@/services/apiServices';
import { formatISTDate } from '@/utils/dateTime';


// ============================================================
// ADMIN BONUS PAYMENTS
// ============================================================

export function BonusPayments() {

  // ==========================================================
  // DATA
  // ==========================================================

  const [records, setRecords] = useState([]);
  const [employeeSummaries, setEmployeeSummaries] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


  // ==========================================================
  // VIEW
  // ==========================================================

  const [view, setView] = useState('PENDING');


  // ==========================================================
  // SEARCH
  // ==========================================================

  const [search, setSearch] = useState('');


  // ==========================================================
  // REVIEW MODAL
  // ==========================================================

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [incentiveAmount, setIncentiveAmount] =
    useState('');


  // ==========================================================
  // ACTION STATES
  // ==========================================================

  const [payingEmployeeId, setPayingEmployeeId] =
    useState(null);

  const [rejectingExtraWorkId, setRejectingExtraWorkId] =
    useState(null);


  // ==========================================================
  // MESSAGES
  // ==========================================================

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');


  // ==========================================================
  // RESPONSE HELPERS
  // ==========================================================

  const unwrap = (response) => {

    return (
      response?.data?.data ??
      response?.data ??
      response
    );

  };


  const getArray = (response) => {

    const data = unwrap(response);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.records)) {
      return data.records;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];

  };


  // ==========================================================
  // EMPLOYEE NAME
  // ==========================================================

  const getEmployeeName = (record) => {

    const employee =
      record?.employee;

    const name =
      `${employee?.firstName || ''} ${
        employee?.lastName || ''
      }`.trim();

    return (
      name ||
      `Employee ${record?.employeeId ?? '-'}`
    );

  };


  // ==========================================================
  // EMPLOYEE EMAIL
  // ==========================================================

  const getEmployeeEmail = (record) => {

    return (
      record?.employee?.email ||
      ''
    );

  };


  // ==========================================================
  // NUMBER
  // ==========================================================

  const getNumber = (value) => {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;

  };


  // ==========================================================
  // FORMAT HOURS
  // ==========================================================

  const formatHours = (value) => {

    return getNumber(value)
      .toFixed(2);

  };


  // ==========================================================
  // FORMAT CURRENCY
  // ==========================================================

  const formatCurrency = (value) => {

    return `₹${getNumber(value).toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;

  };


  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (value) => {

    if (!value) {
      return '-';
    }

    const formatted =
      formatISTDate(
        value,
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      );

    return formatted === '—'
      ? '-'
      : formatted;

  };


  // ==========================================================
  // PAYROLL PERIOD
  // ==========================================================

  const getPeriod = (record) => {

    const start =
      record?.payroll?.payPeriodStart ??
      record?.payPeriodStart;

    const end =
      record?.payroll?.payPeriodEnd ??
      record?.payPeriodEnd;

    if (!start && !end) {
      return '-';
    }

    return `${formatDate(start)} → ${formatDate(end)}`;

  };


  // ==========================================================
  // EXPECTED HOURS
  // ==========================================================

  const getExpectedHours = (record) => {

    return getNumber(
      record?.payroll?.monthlyExpectedHours ??
      record?.monthlyExpectedHours ??
      record?.payroll?.expectedHours
    );

  };


  // ==========================================================
  // REGULAR WORKING HOURS
  // ==========================================================

  const getRegularHours = (record) => {

    return getNumber(
      record?.payroll?.regularWorkingHours ??
      record?.regularWorkingHours
    );

  };


  // ==========================================================
  // EXTRA HOURS
  // ==========================================================

  const getExtraHours = (record) => {

    return getNumber(
      record?.extraHours
    );

  };


  // ==========================================================
  // ACCUMULATED EXTRA HOURS
  // ==========================================================

  const getAccumulatedHours = (record) => {

    return getNumber(
      record?.accumulatedExtraHours ??
      record?.accumulatedHours ??
      record?.currentAccumulatedExtraHours ??
      record?.extraHours
    );

  };


  // ==========================================================
  // BUILD EMPLOYEE SUMMARIES (FALLBACK)
  // ==========================================================

  const buildEmployeeSummaries = (pendingRecords) => {

    const grouped = new Map();

    pendingRecords.forEach((record) => {

      const employeeId =
        record?.employeeId;

      if (employeeId === null || employeeId === undefined) {
        return;
      }

      const key = String(employeeId);
      const existing = grouped.get(key);

      if (!existing) {

        grouped.set(key, {
          employeeId,
          employee: record?.employee || null,
          accumulatedExtraHours: 0,
          accumulatedRecordCount: 0,
          status: 'ACCUMULATED',
          records: [],
        });

      }

      const summary = grouped.get(key);

      if (record?.status === 'ACCUMULATED' && !record?.settlementId) {

        summary.accumulatedExtraHours +=
          getExtraHours(record);

        summary.accumulatedRecordCount += 1;
        summary.records.push(record);

      }

    });

    return Array.from(grouped.values())
      .filter(
        (summary) =>
          summary.accumulatedExtraHours > 0
      )
      .sort(
        (a, b) =>
          b.accumulatedExtraHours -
          a.accumulatedExtraHours
      );

  };


  // ==========================================================
  // LOAD PENDING BONUS RECORDS
  // ==========================================================

  const loadPending = async () => {

    const response =
      await bonusService.extraWork.list({
        status: 'ACCUMULATED',
      });

    const data = unwrap(response);

    const pendingRecords =
      getArray(response).filter(
        (record) =>
          record?.status === 'ACCUMULATED' &&
          !record?.settlementId &&
          getExtraHours(record) > 0
      );

    const apiSummaries =
      Array.isArray(data?.employeeSummaries)
        ? data.employeeSummaries
        : [];

    const summaries =
      apiSummaries.length > 0
        ? apiSummaries.map((summary) => {

            const summaryRecords =
              pendingRecords.filter(
                (record) =>
                  String(record?.employeeId ?? '') ===
                  String(summary?.employeeId ?? '')
              );

            return {
              ...summary,
              accumulatedExtraHours:
                getNumber(summary?.accumulatedExtraHours),
              accumulatedRecordCount:
                getNumber(summary?.accumulatedRecordCount) ||
                summaryRecords.length,
              records: summaryRecords,
            };

          })
            .filter(
              (summary) =>
                summary.accumulatedExtraHours > 0
            )
            .sort(
              (a, b) =>
                b.accumulatedExtraHours -
                a.accumulatedExtraHours
            )
        : buildEmployeeSummaries(
            pendingRecords
          );

    setRecords(pendingRecords);
    setEmployeeSummaries(summaries);

  };


  // ==========================================================
  // LOAD BONUS PAYMENT HISTORY
  // ==========================================================

  const loadHistory = async () => {

    setHistoryLoading(true);

    try {

      const response =
        await bonusService.history();

      setHistory(
        getArray(response)
      );

    } finally {

      setHistoryLoading(false);

    }

  };


  // ==========================================================
  // LOAD EVERYTHING
  // ==========================================================

  const loadAll = async (
    showSpinner = true
  ) => {

    try {

      if (showSpinner) {
        setLoading(true);
      }

      setError('');

      await loadPending();
      await loadHistory();

    } catch (loadError) {

      console.error(
        'Failed to load bonus payments:',
        loadError
      );

      setError(
        loadError?.response?.data?.message ||
        loadError?.message ||
        'Failed to load bonus payment records.'
      );

    } finally {

      setLoading(false);

    }

  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadAll(true);

  }, []);


  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = async () => {

    try {

      setRefreshing(true);

      setMessage('');
      setError('');

      await loadAll(false);

    } finally {

      setRefreshing(false);

    }

  };


  // ==========================================================
  // FILTER PENDING EMPLOYEE SUMMARIES
  // ==========================================================

  const filteredEmployeeSummaries =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return employeeSummaries;
      }

      return employeeSummaries.filter(
        (summary) => {

          const employeeName =
            getEmployeeName(
              summary
            ).toLowerCase();

          const employeeId =
            String(
              summary?.employeeId ?? ''
            ).toLowerCase();

          const email =
            getEmployeeEmail(
              summary
            ).toLowerCase();

          const periods =
            (Array.isArray(summary?.records)
              ? summary.records
              : []
            )
              .map((record) => getPeriod(record))
              .join(' ')
              .toLowerCase();

          return (
            employeeName.includes(term) ||
            employeeId.includes(term) ||
            email.includes(term) ||
            periods.includes(term) ||
            String(summary?.status ?? '')
              .toLowerCase()
              .includes(term)
          );

        }
      );

    }, [
      employeeSummaries,
      search,
    ]);


  // ==========================================================
  // FILTER HISTORY
  // ==========================================================

  const filteredHistory =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return history;
      }

      return history.filter(
        (settlement) => {

          const employeeName =
            getEmployeeName(
              settlement
            ).toLowerCase();

          const employeeId =
            String(
              settlement?.employeeId ?? ''
            ).toLowerCase();

          const period =
            getPeriod(
              settlement
            ).toLowerCase();

          return (
            employeeName.includes(term) ||
            employeeId.includes(term) ||
            period.includes(term)
          );

        }
      );

    }, [
      history,
      search,
    ]);


  // ==========================================================
  // OPEN REVIEW
  // ==========================================================

  const openReview = (record) => {

    setSelectedRecord(record);

    setIncentiveAmount('');

    setMessage('');
    setError('');

  };


  // ==========================================================
  // CLOSE REVIEW
  // ==========================================================

  const closeReview = () => {

    if (
      payingEmployeeId ||
      rejectingExtraWorkId
    ) {
      return;
    }

    setSelectedRecord(null);

    setIncentiveAmount('');

  };


  // ==========================================================
  // PAY BONUS
  // ==========================================================

  const handleApproveAndPay = async () => {

    if (!selectedRecord?.employeeId) {

      setError(
        'Employee ID is missing for this bonus settlement.'
      );

      return;

    }

    const amount =
      Number(
        incentiveAmount || 0
      );

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {

      setError(
        'Bonus amount must be zero or a positive number.'
      );

      return;

    }

    const accumulatedHours =
      getAccumulatedHours(
        selectedRecord
      );

    if (
      accumulatedHours <= 0
    ) {

      setError(
        'There are no accumulated extra hours available for this employee.'
      );

      return;

    }

    try {

      setPayingEmployeeId(
        selectedRecord.employeeId
      );

      setMessage('');
      setError('');

      await bonusService.pay({

        employeeId:
          selectedRecord.employeeId,

        payrollId:
          null,

        incentiveAmount:
          amount,

      });

      const employeeName =
        getEmployeeName(
          selectedRecord
        );

      setSelectedRecord(null);
      setIncentiveAmount('');

      setMessage(
        `${employeeName}'s full accumulated extra-work bonus was paid successfully. The accumulated balance has been settled and reset to 0. Regular payroll remains unchanged.`
      );

      await loadPending();
      await loadHistory();

    } catch (payError) {

      console.error(
        'Failed to pay bonus:',
        payError
      );

      setError(
        payError?.response?.data?.message ||
        payError?.message ||
        'Failed to process bonus payment.'
      );

    } finally {

      setPayingEmployeeId(null);

    }

  };


  // ==========================================================
  // REJECT EXTRA WORK
  // ==========================================================

  const handleReject = async (
    record
  ) => {

    if (
      !record?.extraWorkId
    ) {

      setError(
        'Extra work ID is missing.'
      );

      return;

    }


    const confirmed =
      window.confirm(
        `Reject ${formatHours(
          record.extraHours
        )} extra hours for ${getEmployeeName(
          record
        )}? The record will remain in history as REJECTED.`
      );


    if (!confirmed) {
      return;
    }


    try {

      setRejectingExtraWorkId(
        record.extraWorkId
      );

      setMessage('');
      setError('');


      await bonusService.extraWork.reject(
        record.extraWorkId
      );


      if (
        String(selectedRecord?.employeeId ?? '') ===
        String(record?.employeeId ?? '')
      ) {

        setSelectedRecord(null);

      }


      setMessage(
        `${formatHours(
          record.extraHours
        )} extra hours for ${getEmployeeName(
          record
        )} were rejected. The record was preserved in history.`
      );


      await loadPending();
      await loadHistory();

    } catch (rejectError) {

      console.error(
        'Failed to reject extra work:',
        rejectError
      );

      setError(
        rejectError?.response?.data?.message ||
        rejectError?.message ||
        'Failed to reject extra-work record.'
      );

    } finally {

      setRejectingExtraWorkId(
        null
      );

    }

  };


  // ==========================================================
  // PENDING EMPLOYEE SUMMARY TABLE COLUMNS
  // ==========================================================

  const pendingColumns =
    useMemo(
      () => [

        {
          key: 'employeeId',
          label: 'Emp ID',

          render: (summary) => (

            <span className="font-mono text-xs font-semibold text-navy-600">
              {summary?.employeeId ?? '-'}
            </span>

          ),
        },


        {
          key: 'employee',
          label: 'Employee',

          render: (summary) => (

            <div>

              <div className="font-medium text-navy-900">
                {getEmployeeName(summary)}
              </div>

              {getEmployeeEmail(summary) && (

                <div className="text-xs text-navy-400">
                  {getEmployeeEmail(summary)}
                </div>

              )}

            </div>

          ),
        },


        {
          key: 'accumulatedExtraHours',
          label: 'Accumulated Extra Hours',

          render: (summary) => (

            <span className="font-semibold text-amber-700">
              {formatHours(
                summary?.accumulatedExtraHours
              )}{' '}
              h
            </span>

          ),
        },


        {
          key: 'recordCount',
          label: 'Records',

          render: (summary) => (

            <span className="font-medium text-navy-700">
              {summary?.accumulatedRecordCount ??
                summary?.records?.length ??
                0}
            </span>

          ),
        },


        {
          key: 'status',
          label: 'Status',

          render: (summary) => (

            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">

              <Clock3 size={13} />

              {String(
                summary?.status ||
                'ACCUMULATED'
              ).toUpperCase()}

            </span>

          ),
        },


        {
          key: 'actions',
          label: 'Action',

          render: (summary) => {

            const isPaying =
              payingEmployeeId ===
              summary?.employeeId;

            return (

              <button
                type="button"
                onClick={() =>
                  openReview(summary)
                }
                disabled={isPaying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {isPaying ? (

                  <Loader2
                    size={14}
                    className="animate-spin"
                  />

                ) : (

                  <Wallet size={14} />

                )}

                {isPaying
                  ? 'Paying...'
                  : 'Review & Pay'
                }

              </button>

            );

          },
        },

      ],
      [
        payingEmployeeId,
      ]
    );


  // ==========================================================
  // HISTORY TABLE COLUMNS
  // ==========================================================

  const historyColumns =
    useMemo(
      () => [

        {
          key: 'settlementId',
          label: 'Settlement ID',

          render: (record) => (

            <span className="font-mono text-xs font-semibold text-navy-600">
              {record?.settlementId ?? '-'}
            </span>

          ),
        },


        {
          key: 'employee',
          label: 'Employee',

          render: (record) => (

            <div>

              <div className="font-medium text-navy-900">
                {getEmployeeName(record)}
              </div>

              <div className="text-xs text-navy-400">
                ID: {record?.employeeId ?? '-'}
              </div>

            </div>

          ),
        },


        {
          key: 'period',
          label: 'Payroll Period',

          render: (record) => (

            <span className="text-sm text-navy-700">
              {getPeriod(record)}
            </span>

          ),
        },


        {
          key: 'settledHours',
          label: 'Settled Hours',

          render: (record) => (

            <span className="font-semibold text-navy-900">
              {formatHours(
                record?.settledHours
              )}{' '}
              h
            </span>

          ),
        },


        {
          key: 'incentiveAmount',
          label: 'Bonus',

          render: (record) => (

            <span className="font-semibold text-green-700">
              {formatCurrency(
                record?.incentiveAmount
              )}
            </span>

          ),
        },


        {
          key: 'settlementDate',
          label: 'Payment Date',

          render: (record) => (

            <span className="text-sm text-navy-700">
              {formatDate(
                record?.settlementDate
              )}
            </span>

          ),
        },


        {
          key: 'status',
          label: 'Status',

          render: () => (

            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">

              <CheckCircle2 size={13} />

              PAID

            </span>

          ),
        },

      ],
      []
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const pendingHours =
    useMemo(
      () => {

        return filteredEmployeeSummaries.reduce(
          (total, summary) =>
            total +
            getAccumulatedHours(summary),
          0
        );

      }, [
        filteredEmployeeSummaries,
      ]
    );


  const settledHours =
    useMemo(() => {

      return filteredHistory.reduce(
        (total, record) =>
          total +
          getNumber(
            record?.settledHours
          ),
        0
      );

    }, [
      filteredHistory,
    ]);


  const settledBonuses =
    useMemo(() => {

      return filteredHistory.reduce(
        (total, record) =>
          total +
          getNumber(
            record?.incentiveAmount
          ),
        0
      );

    }, [
      filteredHistory,
    ]);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading bonus payments..."
      />
    );

  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <PageHeader
        title="Bonus Payments"
        subtitle={
          view === 'PENDING'
            ? `${filteredEmployeeSummaries.length} employee${
                filteredEmployeeSummaries.length !== 1
                  ? 's'
                  : ''
              } with accumulated bonus`
            : `${filteredHistory.length} bonus payment record${
                filteredHistory.length !== 1
                  ? 's'
                  : ''
              }`
        }
        actions={

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {refreshing ? (

              <Loader2
                size={17}
                className="animate-spin"
              />

            ) : (

              <RefreshCw
                size={17}
              />

            )}

            {refreshing
              ? 'Refreshing...'
              : 'Refresh'
            }

          </button>

        }
      />


      {/* ======================================================
          SUCCESS MESSAGE
      ====================================================== */}

      {message && (

        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

          {message}

        </div>

      )}


      {/* ======================================================
          ERROR MESSAGE
      ====================================================== */}

      {error && (

        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">

          {error}

        </div>

      )}


      {/* ======================================================
          SEARCH
      ====================================================== */}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end">

        <div className="flex-1">

          <label className="mb-1 block text-xs font-medium text-navy-500">
            Search Employee
          </label>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name, ID, email or period..."
          />

        </div>

      </div>


      {/* ======================================================
          TABS
      ====================================================== */}

      <div className="mb-5 flex w-fit items-center gap-1 rounded-xl border border-navy-100 bg-white p-1">

        <button
          type="button"
          onClick={() => {

            setView('PENDING');

            setMessage('');
            setError('');

          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            view === 'PENDING'
              ? 'bg-navy-800 text-white'
              : 'text-navy-600 hover:bg-navy-50'
          }`}
        >

          <Clock3 size={16} />

          Pending Bonuses

          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              view === 'PENDING'
                ? 'bg-white/15 text-white'
                : 'bg-navy-50 text-navy-600'
            }`}
          >

            {employeeSummaries.length}

          </span>

        </button>


        <button
          type="button"
          onClick={() => {

            setView('HISTORY');

            setMessage('');
            setError('');

          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            view === 'HISTORY'
              ? 'bg-navy-800 text-white'
              : 'text-navy-600 hover:bg-navy-50'
          }`}
        >

          <CheckCircle2 size={16} />

          Payment History

          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              view === 'HISTORY'
                ? 'bg-white/15 text-white'
                : 'bg-navy-50 text-navy-600'
            }`}
          >

            {history.length}

          </span>

        </button>

      </div>


      {/* ======================================================
          SUMMARY CARDS
      ====================================================== */}

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-xl border border-navy-100 bg-white p-4">

          <div className="text-xs font-medium text-navy-400">
            Pending Extra Hours
          </div>

          <div className="mt-1 text-2xl font-bold text-navy-900">

            {formatHours(
              pendingHours
            )}{' '}
            h

          </div>

          <div className="mt-1 text-xs text-navy-500">
            Extra work awaiting bonus settlement
          </div>

        </div>


        <div className="rounded-xl border border-navy-100 bg-white p-4">

          <div className="text-xs font-medium text-navy-400">
            Settled Hours
          </div>

          <div className="mt-1 text-2xl font-bold text-navy-900">

            {formatHours(
              settledHours
            )}{' '}
            h

          </div>

          <div className="mt-1 text-xs text-navy-500">
            Historical bonus settlements
          </div>

        </div>


        <div className="rounded-xl border border-navy-100 bg-white p-4">

          <div className="text-xs font-medium text-navy-400">
            Total Bonuses Paid
          </div>

          <div className="mt-1 text-2xl font-bold text-navy-900">

            {formatCurrency(
              settledBonuses
            )}

          </div>

          <div className="mt-1 text-xs text-navy-500">
            Historical extra-work bonus payments
          </div>

        </div>

      </div>


      {/* ======================================================
          PENDING VIEW
      ====================================================== */}

      {view === 'PENDING' ? (

        filteredEmployeeSummaries.length === 0 ? (

          <EmptyState
            icon={Clock3}
            title="No pending bonus payments"
            message={
              search
                ? 'No bonus records match your search.'
                : 'Employees with accumulated extra-work hours will appear here.'
            }
          />

        ) : (

          <DataTable
            columns={pendingColumns}
            data={filteredEmployeeSummaries}
          />

        )

      ) : (

        /* ====================================================
           PAYMENT HISTORY
        ==================================================== */

        historyLoading ? (

          <div className="rounded-xl border border-navy-100 bg-white py-12 text-center text-sm text-navy-500">

            Loading bonus payment history...

          </div>

        ) : filteredHistory.length === 0 ? (

          <EmptyState
            icon={CheckCircle2}
            title="No bonus payment history"
            message={
              search
                ? 'No payment records match your search.'
                : 'Paid extra-work bonuses will appear here.'
            }
          />

        ) : (

          <DataTable
            columns={historyColumns}
            data={filteredHistory}
          />

        )

      )}


      {/* ======================================================
          REVIEW / BONUS PAYMENT MODAL
      ====================================================== */}

      {selectedRecord && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

            {/* ------------------------------------------------
                MODAL HEADER
            ------------------------------------------------- */}

            <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">

              <div>

                <h2 className="text-lg font-semibold text-navy-900">
                  Review Accumulated Bonus
                </h2>

                <p className="mt-0.5 text-sm text-navy-500">
                  {getEmployeeName(
                    selectedRecord
                  )}
                </p>

              </div>


              <button
                type="button"
                onClick={closeReview}
                disabled={
                  Boolean(
                    payingEmployeeId ||
                    rejectingExtraWorkId
                  )
                }
                className="rounded-lg p-2 text-navy-500 transition-colors hover:bg-navy-50 hover:text-navy-800 disabled:opacity-50"
                aria-label="Close"
              >

                <XCircle
                  size={20}
                />

              </button>

            </div>


            {/* ------------------------------------------------
                MODAL BODY
            ------------------------------------------------- */}

            <div className="p-5">

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

                <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">

                  <div className="text-xs text-navy-400">
                    Employee ID
                  </div>

                  <div className="mt-1 font-semibold text-navy-800">
                    {selectedRecord.employeeId ?? '-'}
                  </div>

                </div>


                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">

                  <div className="text-xs text-amber-600">
                    Accumulated Extra Hours
                  </div>

                  <div className="mt-1 text-lg font-bold text-amber-800">
                    {formatHours(
                      getAccumulatedHours(
                        selectedRecord
                      )
                    )}{' '}
                    h
                  </div>

                </div>


                <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">

                  <div className="text-xs text-navy-400">
                    Pending Records
                  </div>

                  <div className="mt-1 font-semibold text-navy-800">
                    {selectedRecord?.accumulatedRecordCount ??
                      selectedRecord?.records?.length ??
                      0}
                  </div>

                </div>

              </div>


              {/* ------------------------------------------------
                  DETAILED RECORDS
              ------------------------------------------------- */}

              <div className="mb-5 rounded-xl border border-navy-100 bg-white">

                <div className="border-b border-navy-100 px-4 py-3">

                  <h3 className="text-sm font-semibold text-navy-800">
                    Accumulated Extra-Work Records
                  </h3>

                  <p className="mt-0.5 text-xs text-navy-500">
                    These records are kept individually. Paying the bonus settles all current accumulated records for this employee together.
                  </p>

                </div>


                <div className="max-h-72 overflow-y-auto">

                  {(Array.isArray(selectedRecord?.records)
                    ? selectedRecord.records
                    : []
                  ).length === 0 ? (

                    <div className="px-4 py-8 text-center text-sm text-navy-500">
                      No accumulated extra-work records are available.
                    </div>

                  ) : (

                    <div className="divide-y divide-navy-100">

                      {selectedRecord.records.map(
                        (record) => (

                          <div
                            key={
                              record?.extraWorkId ??
                              `${record?.employeeId}-${record?.payPeriodStart}-${record?.createdAt}`
                            }
                            className="px-4 py-3"
                          >

                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                              <div className="min-w-0 flex-1">

                                <div className="text-sm font-medium text-navy-800">
                                  {getPeriod(record)}
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-500">

                                  <span>
                                    Regular: {formatHours(
                                      getRegularHours(record)
                                    )} h
                                  </span>

                                  <span>
                                    Extra: {formatHours(
                                      getExtraHours(record)
                                    )} h
                                  </span>

                                  <span>
                                    Total: {formatHours(
                                      record?.totalWorkingHours ??
                                      getRegularHours(record) +
                                        getExtraHours(record)
                                    )} h
                                  </span>

                                </div>

                              </div>


                              <button
                                type="button"
                                onClick={() =>
                                  handleReject(record)
                                }
                                disabled={
                                  Boolean(
                                    payingEmployeeId ||
                                    rejectingExtraWorkId
                                  )
                                }
                                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs font-semibold text-error-700 hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >

                                {rejectingExtraWorkId ===
                                record?.extraWorkId ? (

                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />

                                ) : (

                                  <XCircle
                                    size={14}
                                  />

                                )}

                                {rejectingExtraWorkId ===
                                record?.extraWorkId
                                  ? 'Rejecting...'
                                  : 'Reject Record'
                                }

                              </button>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </div>

              </div>


              {/* ------------------------------------------------
                  BONUS AMOUNT
              ------------------------------------------------- */}

              <div className="rounded-xl border border-navy-100 bg-white p-4">

                <label
                  htmlFor="bonus-amount"
                  className="mb-1 block text-sm font-semibold text-navy-800"
                >
                  Bonus Amount
                </label>

                <div className="mb-2 text-xs text-navy-500">
                  Enter the amount to settle against all of the employee's currently accumulated extra work.
                </div>

                <div className="flex items-center rounded-lg border border-navy-200 bg-white focus-within:ring-2 focus-within:ring-navy-200">

                  <span className="px-3 text-navy-500">
                    ₹
                  </span>

                  <input
                    id="bonus-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={incentiveAmount}
                    onChange={(event) =>
                      setIncentiveAmount(
                        event.target.value
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-r-lg border-0 px-2 py-2.5 text-navy-800 focus:outline-none"
                    disabled={
                      Boolean(
                        payingEmployeeId ||
                        rejectingExtraWorkId
                      )
                    }
                  />

                </div>

              </div>


              {/* ------------------------------------------------
                  INFORMATION
              ------------------------------------------------- */}

              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                Paying the bonus settles <strong>all current accumulated extra-work records</strong> for this employee into one bonus settlement. Those ledger records remain preserved as SETTLED, and the employee's accumulated balance becomes 0. Future extra work starts a new accumulation cycle. Regular salary payroll remains unchanged.
              </div>


              {/* ------------------------------------------------
                  ACTION BUTTONS
              ------------------------------------------------- */}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeReview}
                  disabled={
                    Boolean(
                      payingEmployeeId ||
                      rejectingExtraWorkId
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleApproveAndPay
                  }
                  disabled={
                    Boolean(
                      payingEmployeeId ||
                      rejectingExtraWorkId
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {payingEmployeeId ===
                  selectedRecord.employeeId ? (

                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                  ) : (

                    <Wallet
                      size={16}
                    />

                  )}

                  {payingEmployeeId ===
                  selectedRecord.employeeId
                    ? 'Paying...'
                    : 'Pay Bonus'
                  }

                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default BonusPayments;