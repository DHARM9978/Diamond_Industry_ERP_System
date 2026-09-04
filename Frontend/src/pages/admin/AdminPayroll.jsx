import { useEffect, useMemo, useState } from 'react';
import { Wallet, Download, RefreshCw } from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';
import { payrollService } from '@/services/apiServices';

export function AdminPayroll() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // --------------------------------------------------
  // Load payroll records
  // --------------------------------------------------

  const loadPayroll = async () => {
    try {
      setLoading(true);

      const response = await payrollService.list();

      /*
       * Backend response:
       *
       * {
       *   success: true,
       *   message: "Payroll records fetched successfully",
       *   data: [...]
       * }
       */

      let payrollRecords = [];

      if (Array.isArray(response)) {
        payrollRecords = response;
      } else if (Array.isArray(response?.data)) {
        payrollRecords = response.data;
      }

      setRecords(payrollRecords);
    } catch (error) {
      console.error(
        'Failed to load payroll:',
        error
      );

      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, []);

  // --------------------------------------------------
  // Format currency
  // --------------------------------------------------

  const formatCurrency = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
      return '₹0';
    }

    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // --------------------------------------------------
  // Format date
  // --------------------------------------------------

  const formatDate = (date) => {
    if (!date) {
      return '-';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '-';
    }

    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // --------------------------------------------------
  // Get employee name
  // --------------------------------------------------

  const getEmployeeName = (record) => {
    const firstName =
      record?.employee?.firstName || '';

    const lastName =
      record?.employee?.lastName || '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return fullName || 'Unknown Employee';
  };

  // --------------------------------------------------
  // Get payroll month
  // --------------------------------------------------

  const getPayrollMonth = (record) => {
    if (!record?.payPeriodStart) {
      return '-';
    }

    const date = new Date(
      record.payPeriodStart
    );

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  };

  // --------------------------------------------------
  // Search
  // --------------------------------------------------

  const filtered = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    if (!searchTerm) {
      return records;
    }

    return records.filter((record) => {
      const employeeName =
        getEmployeeName(record).toLowerCase();

      const employeeId =
        String(
          record?.employeeId ?? ''
        ).toLowerCase();

      const month =
        getPayrollMonth(record).toLowerCase();

      return (
        employeeName.includes(searchTerm) ||
        employeeId.includes(searchTerm) ||
        month.includes(searchTerm)
      );
    });
  }, [records, search]);

  // --------------------------------------------------
  // CSV helper
  // --------------------------------------------------

  const escapeCsvValue = (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    const stringValue = String(value);

    /*
     * Escape quotes and wrap values containing
     * commas, quotes or new lines.
     */

    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(
        /"/g,
        '""'
      )}"`;
    }

    return stringValue;
  };

  // --------------------------------------------------
  // Export payroll
  // --------------------------------------------------

  const handleExport = () => {
    if (filtered.length === 0) {
      return;
    }

    const headers = [
      'Payroll ID',
      'Employee ID',
      'Employee Name',
      'Email',
      'Pay Period Start',
      'Pay Period End',
      'Working Hours',
      'Basic Salary',
      'Advance Deduction',
      'Net Salary',
      'Payment Date',
    ];

    const rows = filtered.map((record) => [
      record.payrollId,
      record.employeeId,
      getEmployeeName(record),
      record.employee?.email || '',
      formatDate(record.payPeriodStart),
      formatDate(record.payPeriodEnd),
      record.totalWorkingHours ?? 0,
      record.basicSalary ?? 0,
      record.advanceDeduction ?? 0,
      record.netSalary ?? 0,
      formatDate(record.paymentDate),
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escapeCsvValue)
          .join(',')
      )
      .join('\n');

    /*
     * UTF-8 BOM helps Excel correctly recognize
     * the CSV file.
     */

    const csvWithBom =
      '\uFEFF' + csv;

    const blob = new Blob(
      [csvWithBom],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    const date =
      new Date()
        .toISOString()
        .split('T')[0];

    link.download =
      `payroll-export-${date}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------
  // Table columns
  // --------------------------------------------------

  const columns = [
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
      key: 'employee',
      label: 'Employee',

      render: (record) => (
        <div>
          <div className="font-medium text-navy-900">
            {getEmployeeName(record)}
          </div>

          {record.employee?.email && (
            <div className="text-xs text-navy-400">
              {record.employee.email}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'month',
      label: 'Month',

      render: (record) => (
        <div>
          <span className="text-navy-700 font-medium">
            {getPayrollMonth(record)}
          </span>

          <div className="text-xs text-navy-400 mt-1">
            {formatDate(record.payPeriodStart)}
            {' — '}
            {formatDate(record.payPeriodEnd)}
          </div>
        </div>
      ),
    },

    {
      key: 'workingHours',
      label: 'Working Hours',
      align: 'right',

      render: (record) => (
        <span className="text-navy-600">
          {record.totalWorkingHours ?? 0} hrs
        </span>
      ),
    },

    {
      key: 'basicSalary',
      label: 'Basic',
      align: 'right',

      render: (record) => (
        <span className="text-navy-600">
          {formatCurrency(
            record.basicSalary
          )}
        </span>
      ),
    },

    {
      key: 'advanceDeduction',
      label: 'Advance Deduction',
      align: 'right',

      render: (record) => (
        <span className="text-error-600 font-medium">
          {Number(record.advanceDeduction) > 0
            ? `-${formatCurrency(
                record.advanceDeduction
              )}`
            : formatCurrency(0)}
        </span>
      ),
    },

    {
      key: 'netSalary',
      label: 'Net Pay',
      align: 'right',

      render: (record) => {
        const netSalary =
          Number(record.netSalary);

        const isNegative =
          netSalary < 0;

        return (
          <span
            className={`font-bold ${
              isNegative
                ? 'text-error-600'
                : 'text-navy-900'
            }`}
          >
            {formatCurrency(netSalary)}
          </span>
        );
      },
    },

    {
      key: 'paymentDate',
      label: 'Payment Date',

      render: (record) => (
        <span className="text-navy-500 text-sm">
          {formatDate(
            record.paymentDate
          )}
        </span>
      ),
    },
  ];

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading payroll..."
      />
    );
  }

  // --------------------------------------------------
  // Page
  // --------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle={`${filtered.length} record${
          filtered.length !== 1
            ? 's'
            : ''
        }`}
        actions={
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export
          </button>
        }
      />

      {/* Search + Refresh */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name or ID..."
          />
        </div>

        <button
          type="button"
          onClick={loadPayroll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
          title="Refresh payroll"
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? 'animate-spin'
                : ''
            }
          />
          Refresh
        </button>
      </div>

      {/* Payroll table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payroll records"
          message={
            search
              ? 'No payroll records match your search.'
              : 'Payroll records will appear here.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
        />
      )}
    </div>
  );
}