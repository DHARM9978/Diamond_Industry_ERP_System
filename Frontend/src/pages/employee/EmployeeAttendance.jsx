import { useState, useEffect } from 'react';
import { CalendarCheck } from 'lucide-react';
import { PageHeader, DataTable, StatCard } from '@/components/ui/PageComponents';
import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { selfService } from '@/services/apiServices';
import { mockEmployeeAttendance, mockEmployeeAttendanceSummary } from '@/services/mockData';

export function EmployeeAttendance() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [att, summ] = await Promise.all([
          selfService.attendance(),
          selfService.attendanceSummary(),
        ]);
        setRecords(Array.isArray(att) ? att : att.data || []);
        setSummary(summ);
      } catch {
        setRecords(mockEmployeeAttendance);
        setSummary(mockEmployeeAttendanceSummary);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const s = summary || mockEmployeeAttendanceSummary;

  const columns = [
    { key: 'date', label: 'Date', render: (r) => <span className="font-medium text-navy-800">{r.date}</span> },
    { key: 'check_in', label: 'Check In', align: 'center', render: (r) => <span className={`font-mono ${r.check_in ? 'text-navy-700' : 'text-navy-300'}`}>{r.check_in || '--'}</span> },
    { key: 'check_out', label: 'Check Out', align: 'center', render: (r) => <span className={`font-mono ${r.check_out ? 'text-navy-700' : 'text-navy-300'}`}>{r.check_out || '--'}</span> },
    { key: 'work_hours', label: 'Hours', align: 'right', render: (r) => <span className="font-semibold text-navy-700">{r.work_hours > 0 ? `${r.work_hours}h` : '--'}</span> },
    { key: 'status', label: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (loading) return <FullPageSpinner message="Loading your attendance..." />;

  return (
    <div>
      <PageHeader title="My Attendance" subtitle="Your daily attendance records" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={CalendarCheck} label="Present" value={s.present} color="success" />
        <StatCard icon={CalendarCheck} label="Absent" value={s.absent} color="error" />
        <StatCard icon={CalendarCheck} label="Late" value={s.late} color="warning" />
        <StatCard icon={CalendarCheck} label="On Leave" value={s.on_leave} color="accent" />
        <StatCard icon={CalendarCheck} label="Weekly Off" value={s.weekly_off} color="navy" />
        <StatCard icon={CalendarCheck} label="Total Hours" value={`${s.total_hours}h`} color="navy" />
      </div>

      {records.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No attendance records" message="Your attendance will appear here once recorded." />
      ) : (
        <DataTable columns={columns} data={records} />
      )}
    </div>
  );
}
