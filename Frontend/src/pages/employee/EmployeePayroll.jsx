import { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { PageHeader, DataTable } from '@/components/ui/PageComponents';
import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { selfService } from '@/services/apiServices';
import { mockEmployeePayroll } from '@/services/mockData';

export function EmployeePayroll() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await selfService.payroll();
        setRecords(Array.isArray(res) ? res : res.data || []);
      } catch {
        setRecords(mockEmployeePayroll);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const columns = [
    { key: 'month', label: 'Month', render: (r) => <span className="font-medium text-navy-900">{r.month}</span> },
    { key: 'basic_salary', label: 'Basic', align: 'right', render: (r) => <span className="text-navy-600">₹{r.basic_salary?.toLocaleString('en-IN')}</span> },
    { key: 'hra', label: 'HRA', align: 'right', render: (r) => <span className="text-navy-600">₹{r.hra?.toLocaleString('en-IN')}</span> },
    { key: 'allowances', label: 'Allowances', align: 'right', render: (r) => <span className="text-navy-600">₹{r.allowances?.toLocaleString('en-IN')}</span> },
    { key: 'deductions', label: 'Deductions', align: 'right', render: (r) => <span className="text-error-600">-₹{r.deductions?.toLocaleString('en-IN')}</span> },
    { key: 'advance_deduction', label: 'Adv. Deduction', align: 'right', render: (r) => <span className="text-error-600">{r.advance_deduction ? `-₹${r.advance_deduction.toLocaleString('en-IN')}` : '—'}</span> },
    { key: 'net_salary', label: 'Net Pay', align: 'right', render: (r) => <span className="font-bold text-navy-900">₹{r.net_salary?.toLocaleString('en-IN')}</span> },
    { key: 'status', label: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (loading) return <FullPageSpinner message="Loading your payroll..." />;

  return (
    <div>
      <PageHeader title="My Payroll" subtitle="Your salary and payslip history" />

      {records.length === 0 ? (
        <EmptyState icon={Wallet} title="No payroll records" message="Your payslips will appear here once payroll is processed." />
      ) : (
        <DataTable columns={columns} data={records} />
      )}
    </div>
  );
}
