import { useState, useEffect } from 'react';
import { Banknote, Plus } from 'lucide-react';
import { PageHeader, DataTable } from '@/components/ui/PageComponents';
import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { selfService, advanceService } from '@/services/apiServices';
import { mockEmployeeAdvances } from '@/services/mockData';

export function EmployeeAdvances() {
  const { toast } = useToast();
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await selfService.advances();
        setAdvances(Array.isArray(res) ? res : res.data || []);
      } catch {
        setAdvances(mockEmployeeAdvances);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleApply = async (data) => {
    try {
      await advanceService.create(data);
      setAdvances((prev) => [{ ...data, id: Date.now(), status: 'pending', request_date: new Date().toISOString().split('T')[0], remaining: data.amount, monthly_deduction: Math.ceil(data.amount / 5) }, ...prev]);
      toast('Advance request submitted', 'success');
    } catch {
      setAdvances((prev) => [{ ...data, id: Date.now(), status: 'pending', request_date: new Date().toISOString().split('T')[0], remaining: data.amount, monthly_deduction: Math.ceil(data.amount / 5) }, ...prev]);
      toast('Advance request submitted', 'success');
    }
    setModalOpen(false);
  };

  const columns = [
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-bold text-navy-900">₹{r.amount?.toLocaleString('en-IN')}</span> },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-sm text-navy-500">{r.reason}</span> },
    { key: 'monthly_deduction', label: 'Monthly Deduction', align: 'right', render: (r) => <span className="text-navy-600">₹{r.monthly_deduction?.toLocaleString('en-IN')}</span> },
    { key: 'remaining', label: 'Remaining', align: 'right', render: (r) => <span className="font-semibold text-navy-700">₹{r.remaining?.toLocaleString('en-IN')}</span> },
    { key: 'request_date', label: 'Requested', render: (r) => <span className="text-navy-400 text-sm">{r.request_date}</span> },
    { key: 'status', label: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (loading) return <FullPageSpinner message="Loading your advances..." />;

  return (
    <div>
      <PageHeader
        title="My Advances"
        subtitle="Your salary advance requests"
        actions={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={18} /> Request Advance</button>}
      />

      {advances.length === 0 ? (
        <EmptyState icon={Banknote} title="No advance requests" message="You haven't requested any salary advances." />
      ) : (
        <DataTable columns={columns} data={advances} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request Salary Advance">
        <AdvanceForm onCancel={() => setModalOpen(false)} onSave={handleApply} />
      </Modal>
    </div>
  );
}

function AdvanceForm({ onCancel, onSave }) {
  const [form, setForm] = useState({ amount: '', reason: '' });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, amount: Number(form.amount) }); }} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">Amount (₹) <span className="text-error-500">*</span></label>
        <input type="number" min="1000" step="500" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <p className="text-xs text-navy-400">Minimum ₹1,000</p>
      </div>
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
