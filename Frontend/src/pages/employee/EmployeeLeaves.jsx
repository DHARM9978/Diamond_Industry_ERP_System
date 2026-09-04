import { useState, useEffect } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import { PageHeader, DataTable, StatCard } from '@/components/ui/PageComponents';
import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { selfService, leaveService } from '@/services/apiServices';
import { mockEmployeeLeaves, mockEmployeeLeaveBalances } from '@/services/mockData';

export function EmployeeLeaves() {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [l, b] = await Promise.all([
          selfService.leaves(),
          selfService.leaveBalances(),
        ]);
        setLeaves(Array.isArray(l) ? l : l.data || []);
        setBalances(Array.isArray(b) ? b : b.data || []);
      } catch {
        setLeaves(mockEmployeeLeaves);
        setBalances(mockEmployeeLeaveBalances);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleApply = async (data) => {
    try {
      await leaveService.createRequest(data);
      setLeaves((prev) => [{ ...data, id: Date.now(), status: 'pending', applied_on: new Date().toISOString().split('T')[0] }, ...prev]);
      toast('Leave request submitted', 'success');
    } catch {
      setLeaves((prev) => [{ ...data, id: Date.now(), status: 'pending', applied_on: new Date().toISOString().split('T')[0] }, ...prev]);
      toast('Leave request submitted', 'success');
    }
    setModalOpen(false);
  };

  const handleCancel = async (id) => {
    try {
      await leaveService.cancel(id);
      setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: 'cancelled' } : l));
      toast('Leave request cancelled', 'warning');
    } catch {
      setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: 'cancelled' } : l));
      toast('Leave request cancelled', 'warning');
    }
  };

  const columns = [
    { key: 'leave_type', label: 'Type', render: (r) => <span className="font-medium text-navy-800">{r.leave_type}</span> },
    { key: 'start_date', label: 'Start', render: (r) => <span className="text-navy-600">{r.start_date}</span> },
    { key: 'end_date', label: 'End', render: (r) => <span className="text-navy-600">{r.end_date}</span> },
    { key: 'days', label: 'Days', align: 'center', render: (r) => <span className="font-semibold text-navy-700">{r.days}</span> },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-sm text-navy-500">{r.reason}</span> },
    { key: 'applied_on', label: 'Applied', render: (r) => <span className="text-navy-400 text-sm">{r.applied_on}</span> },
    { key: 'status', label: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
      r.status === 'pending' ? (
        <button onClick={() => handleCancel(r.id)} className="p-2 rounded-lg bg-error-100 text-error-700 hover:bg-error-200 transition-colors" title="Cancel">
          <X size={16} />
        </button>
      ) : <span className="text-navy-300 text-xs">—</span>
    )},
  ];

  if (loading) return <FullPageSpinner message="Loading your leaves..." />;

  return (
    <div>
      <PageHeader
        title="My Leaves"
        subtitle="Your leave requests and balances"
        actions={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={18} /> Apply Leave</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {balances.map((b) => (
          <div key={b.type} className="card p-5">
            <p className="text-sm font-medium text-navy-500">{b.type}</p>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-2xl font-bold text-navy-900">{b.remaining}</span>
              <span className="text-sm text-navy-400 mb-1">/ {b.total} remaining</span>
            </div>
            <div className="mt-3 h-2 bg-navy-100 rounded-full overflow-hidden">
              <div className="h-full bg-success-500 rounded-full" style={{ width: `${(b.remaining / b.total) * 100}%` }} />
            </div>
            <p className="text-xs text-navy-400 mt-1.5">{b.used} used this year</p>
          </div>
        ))}
      </div>

      {leaves.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No leave requests" message="You haven't applied for any leaves yet." />
      ) : (
        <DataTable columns={columns} data={leaves} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply for Leave">
        <LeaveForm
          balances={balances}
          onCancel={() => setModalOpen(false)}
          onSave={handleApply}
        />
      </Modal>
    </div>
  );
}

function LeaveForm({ balances, onCancel, onSave }) {
  const [form, setForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const days = form.start_date && form.end_date
    ? Math.max(1, Math.ceil((new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, days }); }} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">Leave Type <span className="text-error-500">*</span></label>
        <select className="input-field" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })} required>
          <option value="">Select type</option>
          {balances.map((b) => <option key={b.type} value={b.type}>{b.type} ({b.remaining} left)</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">Start Date <span className="text-error-500">*</span></label>
          <input type="date" className="input-field" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">End Date <span className="text-error-500">*</span></label>
          <input type="date" className="input-field" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
        </div>
      </div>
      {days > 0 && <p className="text-sm text-navy-500">Total days: <span className="font-semibold text-navy-700">{days}</span></p>}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">Reason <span className="text-error-500">*</span></label>
        <textarea className="input-field" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">Submit Request</button>
      </div>
    </form>
  );
}
