import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { PageHeader, DataTable } from '@/components/ui/PageComponents';
import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { selfService } from '@/services/apiServices';

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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
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

export function EmployeePayroll() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overtimeTab, setOvertimeTab] = useState('records');

  useEffect(() => {
    let isMounted = true;

    const loadPayroll = async () => {
      try {
        const response = await selfService.payroll();

        const data = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

        if (isMounted) {
          setRecords(data);
        }
      } catch (error) {
        console.error('Failed to load payroll:', error);

        if (isMounted) {
          setRecords([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPayroll();

    return () => {
      isMounted = false;
    };
  }, []);

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
              Paid: {formatDate(record.paymentDate)}
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
        const deduction = Number(record.advanceDeduction || 0);

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
      render: (record) => <StatusBadge status={record.status} />,
    },
  ];

  /*
   * Build employee overtime data from the payroll response.
   *
   * Extra-work records belong to a payroll period, so the payroll record
   * supplies the period displayed in the employee's overtime table.
   *
   * The maps prevent duplicate rows if the same relation is returned
   * through more than one payroll record.
   */
  const overtimeMap = new Map();
  const settlementMap = new Map();

  records.forEach((payroll) => {
    const extraWorkRecords = Array.isArray(payroll.extraWorkRecords)
      ? payroll.extraWorkRecords
      : [];

    extraWorkRecords.forEach((record) => {
      const extraHours = Number(record.extraHours || 0);

      // Do not show empty overtime rows to the employee.
      if (extraHours <= 0) {
        return;
      }

      const key =
        record.extraWorkId ??
        `${payroll.payrollId}-${record.createdAt}`;

      if (!overtimeMap.has(key)) {
        overtimeMap.set(key, {
          ...record,
          payrollId: record.payrollId ?? payroll.payrollId,
          payPeriodStart: payroll.payPeriodStart,
          payPeriodEnd: payroll.payPeriodEnd,
          extraHours,
        });
      }
    });

    const settlements = Array.isArray(payroll.extraWorkSettlements)
      ? payroll.extraWorkSettlements
      : [];

    settlements.forEach((settlement) => {
      const key =
        settlement.settlementId ??
        `${payroll.payrollId}-${settlement.settlementDate}`;

      if (!settlementMap.has(key)) {
        settlementMap.set(key, {
          ...settlement,
          payrollId: settlement.payrollId ?? payroll.payrollId,
          payPeriodStart:
            settlement.payPeriodStart ?? payroll.payPeriodStart,
          payPeriodEnd:
            settlement.payPeriodEnd ?? payroll.payPeriodEnd,
        });
      }
    });
  });

  const overtimeRecords = Array.from(overtimeMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  const settlementHistory = Array.from(settlementMap.values()).sort(
    (a, b) =>
      new Date(b.settlementDate || 0) -
      new Date(a.settlementDate || 0)
  );

  const overtimeColumns = [
    {
      key: 'payPeriod',
      label: 'Pay Period',
      render: (record) => (
        <div>
          <div className="font-medium text-navy-900">
            {formatPayPeriod(record)}
          </div>

          {record.payrollId && (
            <div className="text-xs text-navy-500 mt-1">
              Payroll #{record.payrollId}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'extraHours',
      label: 'Extra Hours',
      align: 'right',
      render: (record) => (
        <span className="font-medium text-navy-900">
          {formatNumber(record.extraHours)}
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

    {
      key: 'recordedDate',
      label: 'Recorded',
      align: 'right',
      render: (record) => formatDate(record.createdAt),
    },
  ];

  const settlementColumns = [
    {
      key: 'payPeriod',
      label: 'Pay Period',
      render: (record) => (
        <div>
          <div className="font-medium text-navy-900">
            {formatPayPeriod(record)}
          </div>

          {record.payrollId && (
            <div className="text-xs text-navy-500 mt-1">
              Payroll #{record.payrollId}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'settledHours',
      label: 'Settled Hours',
      align: 'right',
      render: (record) => (
        <span className="font-medium text-navy-900">
          {formatNumber(record.settledHours)}
        </span>
      ),
    },

    {
      key: 'incentiveAmount',
      label: 'Overtime Pay',
      align: 'right',
      render: (record) => (
        <span className="font-bold text-navy-900">
          {formatCurrency(record.incentiveAmount)}
        </span>
      ),
    },

    {
      key: 'settlementDate',
      label: 'Settlement Date',
      align: 'right',
      render: (record) => formatDate(record.settlementDate),
    },

    {
      key: 'settlementId',
      label: 'Settlement',
      align: 'center',
      render: (record) => (
        <span className="text-navy-600">
          #{record.settlementId || '—'}
        </span>
      ),
    },
  ];

  if (loading) {
    return <FullPageSpinner message="Loading your payroll..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Payroll"
        subtitle="Your salary and payslip history"
      />

      {/* ============================================================
          REGULAR PAYROLL
          ============================================================ */}
      <section>
        {records.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payroll records"
            message="Your payslips will appear here once payroll is processed."
          />
        ) : (
          <DataTable columns={columns} data={records} />
        )}
      </section>

      {/* ============================================================
          OVERTIME
          ============================================================ */}
      {overtimeRecords.length > 0 || settlementHistory.length > 0 ? (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-navy-900">
              My Overtime
            </h2>

            <p className="text-sm text-navy-500 mt-1">
              View your recorded overtime and separately settled overtime payments.
            </p>
          </div>

          {/* Overtime navigation */}
          <div className="border-b border-navy-200 mb-4">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setOvertimeTab('records')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  overtimeTab === 'records'
                    ? 'border-navy-900 text-navy-900'
                    : 'border-transparent text-navy-500 hover:text-navy-900'
                }`}
              >
                Overtime Records
                {overtimeRecords.length > 0 && (
                  <span className="ml-2 text-xs">
                    ({overtimeRecords.length})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setOvertimeTab('settlements')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  overtimeTab === 'settlements'
                    ? 'border-navy-900 text-navy-900'
                    : 'border-transparent text-navy-500 hover:text-navy-900'
                }`}
              >
                Payment Settlements
                {settlementHistory.length > 0 && (
                  <span className="ml-2 text-xs">
                    ({settlementHistory.length})
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Overtime Records tab */}
          {overtimeTab === 'records' && (
            <>
              {overtimeRecords.length > 0 ? (
                <DataTable
                  columns={overtimeColumns}
                  data={overtimeRecords}
                />
              ) : (
                <EmptyState
                  title="No overtime records"
                  message="Your recorded overtime will appear here."
                />
              )}
            </>
          )}

          {/* Payment Settlements tab */}
          {overtimeTab === 'settlements' && (
            <>
              {settlementHistory.length > 0 ? (
                <DataTable
                  columns={settlementColumns}
                  data={settlementHistory}
                />
              ) : (
                <EmptyState
                  title="No overtime payments"
                  message="Your settled overtime payments will appear here."
                />
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}