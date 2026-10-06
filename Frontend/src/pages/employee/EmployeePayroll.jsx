import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  RefreshCw,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

import { selfService } from '@/services/apiServices';
import { formatISTDate } from '@/utils/dateTime';


// ============================================================
// HELPERS
// ============================================================

const formatCurrency = (value) => {
  const number = Number(value || 0);

  return `₹${number.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};


const formatNumber = (value) => {
  const number = Number(value || 0);

  return number.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


const formatDate = (value) => {
  if (!value) return '—';

  return formatISTDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};


const formatPayPeriod = (record) => {
  if (!record?.payPeriodStart && !record?.payPeriodEnd) {
    return '—';
  }

  const start = record.payPeriodStart
    ? formatDate(record.payPeriodStart)
    : '—';

  const end = record.payPeriodEnd
    ? formatDate(record.payPeriodEnd)
    : '—';

  return `${start} - ${end}`;
};


// ------------------------------------------------------------
// Calendar-safe YYYY-MM-DD extraction.
// This avoids UTC -> IST previous-day shifts for DATE fields.
// ------------------------------------------------------------

const toCalendarDateString = (value) => {
  if (!value) return null;

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};


const getCurrentISTMonthYear = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());

  const values = {};

  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return {
    month: Number(values.month),
    year: Number(values.year),
  };
};


const getMonthRange = (month, year) => {
  const paddedMonth = String(month).padStart(2, '0');

  const lastDay = new Date(
    Number(year),
    Number(month),
    0
  ).getDate();

  return {
    start: `${year}-${paddedMonth}-01`,
    end: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
  };
};


const getMonthLabel = (month, year) => {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(
    new Date(
      Number(year),
      Number(month) - 1,
      1
    )
  );
};


const payrollOverlapsMonth = (
  record,
  month,
  year
) => {
  const start =
    toCalendarDateString(
      record?.payPeriodStart
    );

  const end =
    toCalendarDateString(
      record?.payPeriodEnd
    );

  if (!start || !end) {
    return false;
  }

  const selected =
    getMonthRange(month, year);

  return (
    start <= selected.end &&
    end >= selected.start
  );
};


const isPayrollPaid = (record) => {
  return (
    String(
      record?.status || ''
    ).toUpperCase() === 'PAID' ||
    Boolean(record?.paymentDate)
  );
};


// ============================================================
// EMPLOYEE PAYROLL
// ============================================================

export function EmployeePayroll() {

  const currentMonthYear =
    useMemo(
      () => getCurrentISTMonthYear(),
      []
    );

  const [records, setRecords] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [selectedMonth, setSelectedMonth] =
    useState(currentMonthYear.month);

  const [selectedYear, setSelectedYear] =
    useState(currentMonthYear.year);


  // ==========================================================
  // LOAD PAYROLL
  // ==========================================================

  const loadPayroll = async (
    showRefresh = false
  ) => {

    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response =
        await selfService.payroll();

      const data =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

      setRecords(data);

    } catch (error) {

      console.error(
        'Failed to load payroll:',
        error
      );

      setRecords([]);

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  useEffect(() => {
    loadPayroll();
  }, []);


  // ==========================================================
  // AVAILABLE YEARS
  // ==========================================================
  //
  // Current year is always available. Older years are taken from
  // the payroll records so the employee can inspect actual history.
  // ==========================================================

  const availableYears = useMemo(() => {

    const years = new Set([
      currentMonthYear.year,
    ]);

    records.forEach((record) => {
      const start =
        toCalendarDateString(
          record?.payPeriodStart
        );

      if (start) {
        years.add(
          Number(start.slice(0, 4))
        );
      }
    });

    return Array.from(years)
      .filter(Number.isFinite)
      .sort((a, b) => b - a);

  }, [records, currentMonthYear.year]);


  // ==========================================================
  // AVAILABLE MONTHS
  // ==========================================================

  const availableMonths = useMemo(() => {

    const current = currentMonthYear;

    return Array.from(
      { length: 12 },
      (_, index) => {
        const month = index + 1;

        return {
          value: month,
          label: new Intl.DateTimeFormat(
            'en-IN',
            { month: 'long' }
          ).format(
            new Date(2000, month - 1, 1)
          ),
        };
      }
    ).filter((option) => (
      Number(selectedYear) < current.year ||
      option.value <= current.month
    ));

  }, [selectedYear, currentMonthYear]);


  useEffect(() => {
    if (
      Number(selectedYear) ===
        currentMonthYear.year &&
      Number(selectedMonth) >
        currentMonthYear.month
    ) {
      setSelectedMonth(
        currentMonthYear.month
      );
    }
  }, [
    selectedYear,
    selectedMonth,
    currentMonthYear,
  ]);


  // ==========================================================
  // FILTERED MONTH PAYROLL
  // ==========================================================

  const selectedMonthRecords =
    useMemo(() => {
      return records.filter((record) =>
        payrollOverlapsMonth(
          record,
          selectedMonth,
          selectedYear
        )
      );
    }, [
      records,
      selectedMonth,
      selectedYear,
    ]);


  // ==========================================================
  // MONTHLY BREAKDOWN
  // ==========================================================
  //
  // Total Salary:
  //     Sum of earned/regular salary (basicSalary).
  //
  // Total Advance Taken:
  //     Sum of advance deductions attached to the selected
  //     payroll records. This is used because it reconciles
  //     directly with the monthly payroll settlement.
  //
  // Settlement:
  //     Actual net salary already paid for PAID payroll records.
  //
  // Total Remaining:
  //     Total Salary - Advance Taken - Settlement.
  //
  // Therefore, after a normal payroll is settled, the remaining
  // amount becomes zero.
  // ==========================================================

  const monthlyBreakdown = useMemo(() => {

    const totalSalary =
      selectedMonthRecords.reduce(
        (total, record) =>
          total +
          Math.max(
            0,
            Number(
              record?.basicSalary || 0
            )
          ),
        0
      );

    const totalAdvanceTaken =
      selectedMonthRecords.reduce(
        (total, record) =>
          total +
          Math.max(
            0,
            Number(
              record?.advanceDeduction || 0
            )
          ),
        0
      );

    const settlement =
      selectedMonthRecords.reduce(
        (total, record) => {
          if (!isPayrollPaid(record)) {
            return total;
          }

          return (
            total +
            Math.max(
              0,
              Number(
                record?.netSalary || 0
              )
            )
          );
        },
        0
      );

    const totalRemaining =
      Math.max(
        0,
        totalSalary -
          totalAdvanceTaken -
          settlement
      );

    return {
      totalSalary,
      totalAdvanceTaken,
      settlement,
      totalRemaining,
    };

  }, [selectedMonthRecords]);


  const selectedMonthLabel =
    getMonthLabel(
      selectedMonth,
      selectedYear
    );


  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

  const columns = [

    {
      key: 'payPeriod',
      label: 'Pay Period',
      render: (record) => (
        <div>
          <div className="font-medium text-navy-900">
            {formatPayPeriod(record)}
          </div>

          {record.paymentDate && (
            <div className="text-xs text-navy-500 mt-1">
              Settled: {formatDate(record.paymentDate)}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'baseSalary',
      label: 'Base Salary',
      align: 'right',
      render: (record) => (
        <span className="text-navy-600">
          {formatCurrency(record.baseSalary)}
        </span>
      ),
    },

    {
      key: 'monthlyExpectedHours',
      label: 'Expected Hrs',
      align: 'right',
      render: (record) => (
        <span className="text-navy-600">
          {formatNumber(record.monthlyExpectedHours)}
        </span>
      ),
    },

    {
      key: 'salaryRatePerHour',
      label: 'Hourly Rate',
      align: 'right',
      render: (record) => (
        <span className="text-navy-600">
          {formatCurrency(record.salaryRatePerHour)}
        </span>
      ),
    },

    {
      key: 'totalWorkingHours',
      label: 'Actual Hrs',
      align: 'right',
      render: (record) => (
        <span className="font-medium text-navy-900">
          {formatNumber(record.totalWorkingHours)}
        </span>
      ),
    },

    {
      key: 'basicSalary',
      label: 'Earned Salary',
      align: 'right',
      render: (record) => (
        <span className="text-navy-600">
          {formatCurrency(record.basicSalary)}
        </span>
      ),
    },

    {
      key: 'advanceDeduction',
      label: 'Advance',
      align: 'right',
      render: (record) => {
        const deduction = Number(
          record.advanceDeduction || 0
        );

        return deduction > 0 ? (
          <span className="text-error-600">
            -{formatCurrency(deduction)}
          </span>
        ) : (
          <span className="text-navy-400">—</span>
        );
      },
    },

    {
      key: 'netSalary',
      label: 'Net Pay',
      align: 'right',
      render: (record) => (
        <span className="font-bold text-navy-900">
          {formatCurrency(record.netSalary)}
        </span>
      ),
    },

    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (record) => (
        <StatusBadge status={record.status} />
      ),
    },
  ];


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading your payroll..."
      />
    );
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="space-y-6">

      <PageHeader
        title="My Payroll"
        subtitle="Your monthly salary settlement and payslip history"
      />


      {/* ======================================================
          MONTH FILTER
          ====================================================== */}

      <section className="card p-4 sm:p-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <p className="text-sm font-semibold text-navy-800">
              Payroll Month
            </p>

            <p className="mt-1 text-xs text-navy-400">
              Current month is shown first. Select an earlier month to view its complete payroll breakdown.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            <div>
              <label
                htmlFor="employee-payroll-month"
                className="mb-1.5 block text-xs font-medium text-navy-500"
              >
                Month
              </label>

              <select
                id="employee-payroll-month"
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(
                    Number(event.target.value)
                  )
                }
                className="h-10 min-w-[170px] rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-800 outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
              >
                {availableMonths.map((month) => (
                  <option
                    key={month.value}
                    value={month.value}
                  >
                    {month.label}
                  </option>
                ))}
              </select>
            </div>


            <div>
              <label
                htmlFor="employee-payroll-year"
                className="mb-1.5 block text-xs font-medium text-navy-500"
              >
                Year
              </label>

              <select
                id="employee-payroll-year"
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(
                    Number(event.target.value)
                  )
                }
                className="h-10 min-w-[120px] rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-800 outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
              >
                {availableYears.map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

      </section>


      {/* ======================================================
          MONTHLY BREAKDOWN
          ====================================================== */}

      <section>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-navy-900">
              {selectedMonthLabel} Payroll Breakdown
            </h2>

            <p className="mt-1 text-xs text-navy-400">
              Salary, advance deduction, settlement, and remaining amount for the selected month.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadPayroll(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-xs font-medium text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />
            Refresh
          </button>
        </div>


        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Total Salary */}
          <div className="rounded-xl border border-navy-100 bg-navy-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-400">
              Total Salary
            </p>

            <p className="mt-1 text-xl font-bold text-navy-900">
              {formatCurrency(
                monthlyBreakdown.totalSalary
              )}
            </p>

            <p className="mt-1 text-[11px] text-navy-400">
              Earned salary for {selectedMonthLabel}
            </p>
          </div>


          {/* Total Advance Taken */}
          <div className="rounded-xl border border-error-100 bg-error-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-error-500">
              Total Advance Taken
            </p>

            <p className="mt-1 text-xl font-bold text-error-700">
              {formatCurrency(
                monthlyBreakdown.totalAdvanceTaken
              )}
            </p>

            <p className="mt-1 text-[11px] text-error-500">
              Deducted from {selectedMonthLabel} payroll
            </p>
          </div>


          {/* Settlement */}
          <div className="rounded-xl border border-success-100 bg-success-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-success-600">
              Settlement
            </p>

            <p className="mt-1 text-xl font-bold text-success-700">
              {formatCurrency(
                monthlyBreakdown.settlement
              )}
            </p>

            <p className="mt-1 text-[11px] text-success-600">
              Salary already paid for {selectedMonthLabel}
            </p>
          </div>


          {/* Remaining Total */}
          <div className="rounded-xl border border-accent-100 bg-accent-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-accent-600">
              Total Remaining
            </p>

            <p className="mt-1 text-xl font-bold text-accent-700">
              {formatCurrency(
                monthlyBreakdown.totalRemaining
              )}
            </p>

            <p className="mt-1 text-[11px] text-accent-600">
              Becomes ₹0 after full salary settlement
            </p>
          </div>

        </div>

      </section>


      {/* ======================================================
          PAYROLL RECORDS
          ====================================================== */}

      <section>

        {selectedMonthRecords.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={`No payroll records for ${selectedMonthLabel}`}
            message="Your payroll records will appear here once payroll is processed for the selected month."
          />
        ) : (
          <DataTable
            columns={columns}
            data={selectedMonthRecords}
          />
        )}

      </section>

    </div>
  );
}
