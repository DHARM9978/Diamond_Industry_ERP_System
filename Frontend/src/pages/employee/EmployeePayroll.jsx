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
  if (!record.payPeriodStart && !record.payPeriodEnd) {
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

  if (loading) {
    return <FullPageSpinner message="Loading your payroll..." />;
  }

  return (
    <div>
      <PageHeader
        title="My Payroll"
        subtitle="Your salary and payslip history"
      />

      {records.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payroll records"
          message="Your payslips will appear here once payroll is processed."
        />
      ) : (
        <DataTable columns={columns} data={records} />
      )}
    </div>
  );
}