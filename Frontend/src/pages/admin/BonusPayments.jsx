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


// ============================================================
// ADMIN BONUS PAYMENTS
// ============================================================

export function BonusPayments() {

  // ==========================================================
  // DATA
  // ==========================================================

  const [records, setRecords] = useState([]);
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

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '-';
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );

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
  // LOAD PENDING BONUS RECORDS
  // ==========================================================

  const loadPending = async () => {

    const response =
      await bonusService.extraWork.list({
        status: 'ACCUMULATED',
      });

    const pendingRecords =
      getArray(response).filter(
        (record) =>
          getExtraHours(record) > 0
      );

    setRecords(
      pendingRecords
    );

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
  // FILTER PENDING RECORDS
  // ==========================================================

  const filteredRecords =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return records;
      }

      return records.filter(
        (record) => {

          const employeeName =
            getEmployeeName(
              record
            ).toLowerCase();

          const employeeId =
            String(
              record?.employeeId ?? ''
            ).toLowerCase();

          const email =
            getEmployeeEmail(
              record
            ).toLowerCase();

          const period =
            getPeriod(
              record
            ).toLowerCase();

          const status =
            String(
              record?.status ?? ''
            ).toLowerCase();

          return (
            employeeName.includes(term) ||
            employeeId.includes(term) ||
            email.includes(term) ||
            period.includes(term) ||
            status.includes(term)
          );

        }
      );

    }, [
      records,
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

    if (
      !selectedRecord?.employeeId
    ) {

      setError(
        'Employee ID is missing for this bonus record.'
      );

      return;

    }


    const amount =
      Number(
        incentiveAmount || 0
      );


    // --------------------------------------------------------
    // BONUS AMOUNT VALIDATION
    // --------------------------------------------------------

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
      amount > 0 &&
      accumulatedHours <= 0
    ) {

      setError(
        'A bonus cannot be entered when there are no accumulated extra hours.'
      );

      return;

    }


    try {

      setPayingEmployeeId(
        selectedRecord.employeeId
      );

      setMessage('');
      setError('');


      // ------------------------------------------------------
      // BONUS PAYMENT
      // ------------------------------------------------------

      await bonusService.pay({

        employeeId:
          selectedRecord.employeeId,

        payrollId:
          selectedRecord.payrollId || null,

        incentiveAmount:
          amount,

      });


      setSelectedRecord(null);
      setIncentiveAmount('');


      setMessage(
        `${getEmployeeName(
          selectedRecord
        )}'s accumulated extra-work bonus was paid successfully. Regular payroll remains unchanged.`
      );


      // ------------------------------------------------------
      // REFRESH
      // ------------------------------------------------------

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
        selectedRecord?.extraWorkId ===
        record.extraWorkId
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
  // PENDING TABLE COLUMNS
  // ==========================================================

  const pendingColumns =
    useMemo(
      () => [

        {
          key: 'employeeId',
          label: 'Emp ID',

          render: (record) => (

            <span className="font-mono text-xs font-semibold text-navy-600">
              {record?.employeeId ?? '-'}
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

              {getEmployeeEmail(record) && (

                <div className="text-xs text-navy-400">
                  {getEmployeeEmail(record)}
                </div>

              )}

            </div>

          ),
        },


        {
          key: 'period',
          label: 'Period',

          render: (record) => (

            <span className="text-sm text-navy-700">
              {getPeriod(record)}
            </span>

          ),
        },


        {
          key: 'extraHours',
          label: 'Extra Hours',

          render: (record) => (

            <span className="font-semibold text-navy-900">
              {formatHours(
                record?.extraHours
              )}{' '}
              h
            </span>

          ),
        },


        {
          key: 'accumulatedExtraHours',
          label: 'Accumulated Balance',

          render: (record) => (

            <span className="font-semibold text-amber-700">
              {formatHours(
                getAccumulatedHours(record)
              )}{' '}
              h
            </span>

          ),
        },


        {
          key: 'status',
          label: 'Status',

          render: (record) => (

            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">

              <Clock3 size={13} />

              {String(
                record?.status ||
                'ACCUMULATED'
              ).toUpperCase()}

            </span>

          ),
        },


        {
          key: 'actions',
          label: 'Action',

          render: (record) => {

            const isPaying =
              payingEmployeeId ===
              record?.employeeId;

            const isRejecting =
              rejectingExtraWorkId ===
              record?.extraWorkId;


            return (

              <div className="flex flex-wrap items-center gap-2">

                <button
                  type="button"
                  onClick={() =>
                    openReview(record)
                  }
                  disabled={
                    isPaying ||
                    isRejecting
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  <Wallet size={14} />

                  Review & Pay

                </button>


                <button
                  type="button"
                  onClick={() =>
                    handleReject(record)
                  }
                  disabled={
                    isPaying ||
                    isRejecting
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs font-semibold text-error-700 transition-colors hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {isRejecting ? (

                    <Loader2
                      size={14}
                      className="animate-spin"
                    />

                  ) : (

                    <XCircle
                      size={14}
                    />

                  )}

                  {isRejecting
                    ? 'Rejecting...'
                    : 'Reject'
                  }

                </button>

              </div>

            );

          },
        },

      ],
      [
        payingEmployeeId,
        rejectingExtraWorkId,
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
    useMemo(() => {

      return filteredRecords.reduce(
        (total, record) =>
          total +
          getAccumulatedHours(record),
        0
      );

    }, [
      filteredRecords,
    ]);


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
            ? `${filteredRecords.length} pending bonus payment${
                filteredRecords.length !== 1
                  ? 's'
                  : ''
              }`
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

            {records.length}

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

        filteredRecords.length === 0 ? (

          <EmptyState
            icon={Clock3}
            title="No pending bonus payments"
            message={
              search
                ? 'No bonus records match your search.'
                : 'Accumulated extra-work records will appear here.'
            }
          />

        ) : (

          <DataTable
            columns={pendingColumns}
            data={filteredRecords}
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

          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">

            {/* ------------------------------------------------
                MODAL HEADER
            ------------------------------------------------- */}

            <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">

              <div>

                <h2 className="text-lg font-semibold text-navy-900">
                  Review Bonus Payment
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

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* EMPLOYEE ID */}

                <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">

                  <div className="text-xs text-navy-400">
                    Employee ID
                  </div>

                  <div className="mt-1 font-semibold text-navy-800">
                    {selectedRecord.employeeId ?? '-'}
                  </div>

                </div>


                {/* PAYROLL PERIOD */}

                <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">

                  <div className="text-xs text-navy-400">
                    Payroll Period
                  </div>

                  <div className="mt-1 font-semibold text-navy-800">
                    {getPeriod(
                      selectedRecord
                    )}
                  </div>

                </div>


                {/* EXPECTED HOURS */}

                <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">

                  <div className="text-xs text-navy-400">
                    Expected Hours
                  </div>

                  <div className="mt-1 font-semibold text-navy-800">

                    {formatHours(
                      getExpectedHours(
                        selectedRecord
                      )
                    )}{' '}
                    h

                  </div>

                </div>


                {/* REGULAR HOURS */}

                <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">

                  <div className="text-xs text-navy-400">
                    Regular Hours
                  </div>

                  <div className="mt-1 font-semibold text-navy-800">

                    {formatHours(
                      getRegularHours(
                        selectedRecord
                      )
                    )}{' '}
                    h

                  </div>

                </div>


                {/* THIS RECORD EXTRA */}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">

                  <div className="text-xs text-amber-600">
                    This Record Extra
                  </div>

                  <div className="mt-1 font-semibold text-amber-800">

                    {formatHours(
                      getExtraHours(
                        selectedRecord
                      )
                    )}{' '}
                    h

                  </div>

                </div>


                {/* ACCUMULATED BALANCE */}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">

                  <div className="text-xs text-amber-600">
                    Accumulated Balance
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

                  Enter the bonus amount to settle against
                  the employee's accumulated extra work.

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
                        payingEmployeeId
                      )
                    }
                  />

                </div>

              </div>


              {/* ------------------------------------------------
                  INFORMATION
              ------------------------------------------------- */}

              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">

                Paying the bonus settles the employee's
                current accumulated extra-work balance,
                records the bonus in payment history, and
                resets the current accumulated balance.
                Regular salary payroll remains unchanged.

              </div>


              {/* ------------------------------------------------
                  ACTION BUTTONS
              ------------------------------------------------- */}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

                {/* REJECT */}

                <button
                  type="button"
                  onClick={() =>
                    handleReject(
                      selectedRecord
                    )
                  }
                  disabled={
                    Boolean(
                      payingEmployeeId ||
                      rejectingExtraWorkId
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-700 hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {rejectingExtraWorkId ===
                  selectedRecord.extraWorkId ? (

                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                  ) : (

                    <XCircle
                      size={16}
                    />

                  )}

                  Reject Record

                </button>


                {/* CANCEL */}

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


                {/* PAY BONUS */}

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