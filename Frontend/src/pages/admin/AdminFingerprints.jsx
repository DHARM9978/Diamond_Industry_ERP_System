import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Fingerprint,
  Plus,
  Pencil,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle
} from 'lucide-react';

import { PageHeader, DataTable } from '@/components/ui/PageComponents';
import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import { employeeService, fingerprintService } from '@/services/apiServices';

const getEmployeeId = (employee) =>
  employee?.employeeId ?? employee?.employee_id ?? employee?.id ?? '';

const getEmployeeName = (employee) => {
  if (!employee) return 'Unknown Employee';
  if (employee.name) return employee.name;

  const firstName = employee?.firstName || '';
  const lastName = employee?.lastName || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown Employee';
};

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export function AdminFingerprints() {
  const { toast } = useToast();

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [enrollmentProgress, setEnrollmentProgress] = useState(null);
  const [enrollmentPollingError, setEnrollmentPollingError] = useState('');

  const loadFingerprints = async (showFullPageLoading = true) => {
    try {
      if (showFullPageLoading) {
        setLoading(true);
      }

      const response = await fingerprintService.list();
      setRecords(normalizeList(response));
    } catch (error) {
      console.error('Failed to load fingerprints:', error);
      setRecords([]);

      toast(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load fingerprints',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);

      const response = await employeeService.list();
      const employeeRecords = normalizeList(response);

      const activeEmployees = employeeRecords.filter(
        (employee) =>
          !employee?.status ||
          String(employee.status).toUpperCase() === 'ACTIVE'
      );

      setEmployees(activeEmployees);
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees([]);

      toast(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load employees',
        'error'
      );
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    loadFingerprints();
    loadEmployees();
  }, []);

  // --------------------------------------------------
  // LIVE ENROLLMENT STATUS + LOG POLLING
  // --------------------------------------------------

  useEffect(() => {
    const enrollmentId = enrollmentProgress?.enrollmentId;

    if (!enrollmentId) {
      return undefined;
    }

    let cancelled = false;
    let intervalId = null;
    let terminalHandled = false;
    let requestInFlight = false;

    const poll = async () => {
      if (cancelled || terminalHandled || requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response =
          await fingerprintService.getEnrollmentStatus(
            enrollmentId
          );

        if (cancelled || terminalHandled) {
          return;
        }

        const status = response?.data || response;

        setEnrollmentPollingError('');
        setEnrollmentProgress((previous) => ({
          ...previous,
          ...status,
          logs: Array.isArray(status?.logs)
            ? status.logs
            : previous?.logs || [],
        }));

        const normalizedStatus =
          String(status?.status || '').toUpperCase();

        if (
          normalizedStatus === 'COMPLETED' ||
          normalizedStatus === 'FAILED'
        ) {
          /*
           * STOP polling permanently at the terminal state.
           *
           * The previous implementation kept polling after
           * FAILED/COMPLETED and repeatedly called
           * loadFingerprints(). That function set loading=true,
           * which repeatedly replaced the page with the
           * full-page loading screen.
           */
          terminalHandled = true;

          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          /*
           * Refresh only the table data. Do not show the
           * full-page loading spinner while the final enrollment
           * result modal is visible.
           */
          await loadFingerprints(false);
          await loadEmployees();
        }
      } catch (error) {
        if (cancelled || terminalHandled) {
          return;
        }

        console.error(
          'Failed to fetch fingerprint enrollment status:',
          error
        );

        setEnrollmentPollingError(
          error?.response?.data?.message ||
          error?.message ||
          'Unable to read machine progress. Retrying...'
        );
      } finally {
        requestInFlight = false;
      }
    };

    /*
     * Fetch immediately, then check once per second.
     */
    poll();
    intervalId = setInterval(poll, 1000);

    return () => {
      cancelled = true;
      terminalHandled = true;

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [enrollmentProgress?.enrollmentId]);


  const getRecordEmployeeName = (record) =>
    getEmployeeName(record?.employee);

  /*
   * Only employees without an existing fingerprint record
   * should appear in the NEW enrollment dropdown.
   *
   * The backend is still the final authority. This frontend
   * filter prevents the common situation where an employee
   * who is already enrolled is selectable and then produces
   * HTTP 409.
   */
  const enrolledEmployeeIds = useMemo(() => {
    return new Set(
      records
        .map((record) => Number(record?.employeeId))
        .filter((id) => Number.isInteger(id) && id > 0)
    );
  }, [records]);

  const availableEmployees = useMemo(() => {
    return employees.filter(
      (employee) =>
        !enrolledEmployeeIds.has(
          Number(getEmployeeId(employee))
        )
    );
  }, [employees, enrolledEmployeeIds]);

  const formatDate = (date) => {
    if (!date) return '—';

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '—';

    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) return records;

    return records.filter((record) => {
      const employeeName =
        getRecordEmployeeName(record).toLowerCase();

      const employeeId = String(record?.employeeId ?? '').toLowerCase();
      const fingerName = String(record?.fingerName ?? '').toLowerCase();
      const sensorSlot = String(record?.sensorSlot ?? '').toLowerCase();
      const templateId = String(record?.templateId ?? '').toLowerCase();
      const status = String(record?.status ?? '').toLowerCase();

      return (
        employeeName.includes(searchTerm) ||
        employeeId.includes(searchTerm) ||
        fingerName.includes(searchTerm) ||
        sensorSlot.includes(searchTerm) ||
        templateId.includes(searchTerm) ||
        status.includes(searchTerm)
      );
    });
  }, [records, search]);

  const handleSave = async (form) => {
    try {
      setSaving(true);

      const employeeId = Number(form.employeeId);
      const fingerName = form.fingerName.trim();

      if (!employeeId) {
        toast('Please select an employee', 'error');
        return;
      }

      if (!fingerName) {
        toast('Please select a finger', 'error');
        return;
      }

      /*
       * Guard against stale frontend state. Even if the table
       * was not refreshed, never intentionally start a second
       * enrollment for an employee already present in records.
       */
      if (
        !editing &&
        records.some(
          (record) =>
            Number(record?.employeeId) === employeeId
        )
      ) {
        toast(
          'This employee already has a fingerprint. Refresh the list before enrolling again.',
          'error'
        );

        await loadFingerprints();
        return;
      }

      if (editing) {
        const response = await fingerprintService.update(
          editing.templateId,
          { fingerName }
        );

        const updatedRecord = response?.data || response;

        setRecords((prev) =>
          prev.map((record) =>
            record.templateId === editing.templateId
              ? {
                ...record,
                ...updatedRecord,
                employee:
                  updatedRecord.employee || record.employee,
              }
              : record
          )
        );

        toast('Fingerprint updated successfully', 'success');

        setModalOpen(false);
        setEditing(null);
        return;
      }

      /*
       * NEW ENROLLMENT:
       *
       * Only employeeId and fingerName are sent.
       * sensorSlot is intentionally NOT sent.
       *
       * The backend automatically allocates the next
       * available sensor slot and creates the PENDING
       * enrollment job consumed by the ESP32.
       */
      const response = await fingerprintService.create({
        employeeId,
        fingerName,
      });

      const enrollment = response?.data || response;

      console.log(
        'Fingerprint enrollment job created:',
        enrollment
      );

      setModalOpen(false);
      setEditing(null);

      setEnrollmentPollingError('');
      setEnrollmentProgress({
        enrollmentId: enrollment?.enrollmentId,
        employeeId: enrollment?.employeeId,
        sensorSlot: enrollment?.sensorSlot,
        fingerName: enrollment?.fingerName,
        status: enrollment?.status || 'PENDING',
        confidence: enrollment?.confidence ?? null,
        errorMessage: enrollment?.errorMessage || '',
        logs: []
      });

      toast(
        'Enrollment request created. Waiting for the fingerprint machine...',
        'success'
      );
    } catch (error) {
      console.error(
        'Fingerprint enrollment/update error:',
        error
      );

      toast(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to process fingerprint enrollment',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

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
            {getRecordEmployeeName(record)}
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
      key: 'fingerName',
      label: 'Finger',
      render: (record) => (
        <span className="text-navy-600">
          {record.fingerName || '—'}
        </span>
      ),
    },
    {
      key: 'templateId',
      label: 'Template ID',
      render: (record) => (
        <span className="font-mono text-xs text-navy-500">
          {record.templateId || '—'}
        </span>
      ),
    },
    {
      key: 'sensorSlot',
      label: 'Sensor Slot',
      render: (record) => (
        <span className="font-mono text-xs text-navy-600">
          {record.sensorSlot || '—'}
        </span>
      ),
    },
    {
      key: 'enrolledAt',
      label: 'Enrolled On',
      render: (record) => (
        <span className="text-navy-500 text-sm">
          {formatDate(record.enrolledAt)}
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
      key: 'actions',
      label: '',
      align: 'right',
      render: (record) => (
        <button
          type="button"
          onClick={() => {
            setEditing(record);
            setModalOpen(true);
          }}
          className="p-2 rounded-lg text-navy-400 hover:bg-navy-100 hover:text-navy-700 transition-colors"
          title="Edit fingerprint"
        >
          <Pencil size={16} />
        </button>
      ),
    },
  ];

  if (loading) {
    return <FullPageSpinner message="Loading fingerprints..." />;
  }

  return (
    <div>
      <PageHeader
        title="Fingerprints"
        subtitle={`${filtered.length} record${filtered.length !== 1 ? 's' : ''
          }`}
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus size={18} />
            Enroll
          </button>
        }
      />

      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name, ID, finger or slot..."
          />
        </div>

        <button
          type="button"
          onClick={loadFingerprints}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Fingerprint}
          title="No fingerprints enrolled"
          message={
            search
              ? 'No fingerprints match your search.'
              : 'Enroll employee fingerprints to enable biometric attendance.'
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? 'Edit Fingerprint' : 'Enroll Fingerprint'}
      >
        <FingerprintForm
          editing={editing}
          employees={
            editing
              ? employees
              : availableEmployees
          }
          employeesLoading={employeesLoading}
          saving={saving}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      </Modal>

      <EnrollmentProgressModal
        enrollment={enrollmentProgress}
        pollingError={enrollmentPollingError}
        onClose={() => {
          const status = String(enrollmentProgress?.status || '').toUpperCase();
          if (status === 'COMPLETED' || status === 'FAILED') {
            setEnrollmentProgress(null);
            setEnrollmentPollingError('');
          }
        }}
      />
    </div>
  );
}

function EnrollmentProgressModal({
  enrollment,
  pollingError,
  onClose,
}) {
  if (!enrollment) return null;

  const status = String(enrollment.status || 'PENDING').toUpperCase();
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';
  const isActive = !isCompleted && !isFailed;

  const logs = Array.isArray(enrollment.logs)
    ? enrollment.logs
    : [];

  const logContainerRef = useRef(null);

  useEffect(() => {
    const container = logContainerRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [logs]);

  const employeeName = getEmployeeName(enrollment.employee);

  const formatLogTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--:--';

    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Modal
      open={true}
      onClose={isActive ? () => { } : onClose}
      title="Fingerprint Enrollment"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-navy-100 bg-navy-50 p-3">
            <p className="text-xs text-navy-400">Employee</p>
            <p className="mt-1 text-sm font-semibold text-navy-900">
              {employeeName !== 'Unknown Employee'
                ? employeeName
                : `Employee ${enrollment.employeeId || '—'}`}
            </p>
            <p className="text-xs text-navy-500 mt-0.5">
              ID: {enrollment.employeeId || '—'}
            </p>
          </div>

          <div className="rounded-lg border border-navy-100 bg-navy-50 p-3">
            <p className="text-xs text-navy-400">Finger</p>
            <p className="mt-1 text-sm font-semibold text-navy-900">
              {enrollment.fingerName || '—'}
            </p>
          </div>

          <div className="rounded-lg border border-navy-100 bg-navy-50 p-3">
            <p className="text-xs text-navy-400">Sensor Slot</p>
            <p className="mt-1 text-sm font-semibold text-navy-900 font-mono">
              {enrollment.sensorSlot || '—'}
            </p>
          </div>
        </div>

        <div
          className={`rounded-lg border p-4 ${isCompleted
              ? 'border-green-200 bg-green-50'
              : isFailed
                ? 'border-red-200 bg-red-50'
                : 'border-navy-100 bg-navy-50'
            }`}
        >
          <div className="flex items-center gap-3">
            {isCompleted ? (
              <CheckCircle2 className="text-green-600" size={22} />
            ) : isFailed ? (
              <XCircle className="text-red-600" size={22} />
            ) : (
              <Loader2 className="text-navy-600 animate-spin" size={22} />
            )}

            <div>
              <p className="text-sm font-semibold text-navy-900">
                {isCompleted
                  ? 'Fingerprint enrolled successfully'
                  : isFailed
                    ? 'Fingerprint enrollment failed'
                    : 'Fingerprint enrollment in progress'}
              </p>
              <p className="text-xs text-navy-500 mt-0.5">
                {isCompleted
                  ? `Enrollment completed${enrollment.confidence != null ? ` with confidence ${enrollment.confidence}` : ''}.`
                  : isFailed
                    ? enrollment.errorMessage || 'The fingerprint machine reported a failure.'
                    : 'Keep this window open and follow the instructions on the fingerprint machine.'}
              </p>
            </div>
          </div>
        </div>

        {pollingError && isActive && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {pollingError}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-navy-800">
                Machine Activity
              </p>
              <p className="text-xs text-navy-400">
                Live progress from the fingerprint machine
              </p>
            </div>

            {isActive && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500">
                <Circle size={8} className="fill-current" />
                Live
              </span>
            )}
          </div>

          <div
            ref={logContainerRef}
            className="h-64 overflow-y-auto rounded-lg border border-navy-200 bg-slate-950 p-3 space-y-1.5"
          >
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Waiting for the fingerprint machine...
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={`${log?.timestamp || index}-${index}`}
                  className="flex items-start gap-3 text-xs font-mono"
                >
                  <span className="shrink-0 text-slate-500">
                    {formatLogTime(log?.timestamp)}
                  </span>
                  <span className="text-slate-200 break-words">
                    {log?.message || ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {isActive && (
          <div className="rounded-lg bg-navy-50 border border-navy-100 p-4">
            <div className="flex items-start gap-3">
              <Fingerprint size={20} className="text-navy-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-navy-800">
                  What to do now
                </p>
                <p className="text-xs text-navy-500 mt-1 leading-relaxed">
                  Follow the machine instructions. The ERP page will update automatically after each enrollment step and will only report success after the ESP32 confirms the physical fingerprint was stored and verified.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isActive}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActive ? 'Enrollment Running...' : 'Close'}
          </button>
        </div>
      </div>
    </Modal>
  );
}


function FingerprintForm({
  editing,
  employees,
  employeesLoading,
  saving,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState({
    employeeId: editing?.employeeId
      ? String(editing.employeeId)
      : '',
    fingerName: editing?.fingerName || 'Right Index',
  });

  useEffect(() => {
    setForm({
      employeeId: editing?.employeeId
        ? String(editing.employeeId)
        : '',
      fingerName: editing?.fingerName || 'Right Index',
    });
  }, [editing]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Employee
        </label>

        <select
          className="input-field"
          value={form.employeeId}
          onChange={(event) =>
            handleChange('employeeId', event.target.value)
          }
          required
          disabled={
            saving ||
            employeesLoading ||
            Boolean(editing)
          }
        >
          <option value="">
            {employeesLoading
              ? 'Loading employees...'
              : employees.length === 0
                ? 'No employees available for enrollment'
                : 'Select employee'}
          </option>

          {employees.map((employee) => {
            const employeeId = getEmployeeId(employee);
            if (!employeeId) return null;

            return (
              <option key={employeeId} value={employeeId}>
                {employeeId} — {getEmployeeName(employee)}
                {employee.email ? ` — ${employee.email}` : ''}
              </option>
            );
          })}
        </select>

        <p className="text-xs text-navy-400">
          Select an active employee who does not already have
          a fingerprint record.
        </p>

        {!editing && !employeesLoading && employees.length === 0 && (
          <p className="text-xs text-amber-600">
            All active employees already have a fingerprint
            record, or no active employees are available.
          </p>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">
            Sensor Slot
          </label>

          <input
            type="number"
            className="input-field bg-navy-50"
            value={editing.sensorSlot ?? ''}
            readOnly
          />

          <p className="text-xs text-navy-400">
            This slot was assigned by the backend during
            enrollment and cannot be changed here.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Finger
        </label>

        <select
          className="input-field"
          value={form.fingerName}
          onChange={(event) =>
            handleChange('fingerName', event.target.value)
          }
          disabled={saving}
        >
          <option value="Right Thumb">Right Thumb</option>
          <option value="Left Thumb">Left Thumb</option>
          <option value="Right Index">Right Index</option>
          <option value="Left Index">Left Index</option>
          <option value="Right Middle">Right Middle</option>
          <option value="Left Middle">Left Middle</option>
          <option value="Right Ring">Right Ring</option>
          <option value="Left Ring">Left Ring</option>
          <option value="Right Pinky">Right Pinky</option>
          <option value="Left Pinky">Left Pinky</option>
        </select>
      </div>

      {!editing && (
        <div className="rounded-lg bg-navy-50 border border-navy-100 p-4">
          <div className="flex items-start gap-3">
            <Fingerprint
              size={20}
              className="text-navy-600 mt-0.5"
            />

            <div>
              <p className="text-sm font-medium text-navy-800">
                Fingerprint enrollment
              </p>

              <p className="text-xs text-navy-500 mt-1 leading-relaxed">
                Select the employee and finger, then click
                Enroll. The backend will automatically assign
                the next available sensor slot and send the
                enrollment request to the connected fingerprint
                machine.
              </p>

              <p className="text-xs text-navy-500 mt-2 leading-relaxed">
                After clicking Enroll, follow the fingerprint
                machine instructions to scan the same finger
                twice. The fingerprint table will show the
                record only after the ESP32 successfully stores
                the physical template and reports success.
              </p>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-lg bg-navy-50 border border-navy-100 p-4">
          <div className="flex items-start gap-3">
            <Fingerprint
              size={20}
              className="text-navy-600 mt-0.5"
            />

            <div>
              <p className="text-sm font-medium text-navy-800">
                Fingerprint metadata
              </p>

              <p className="text-xs text-navy-500 mt-1 leading-relaxed">
                Editing changes the fingerprint record
                metadata only. It does not re-enroll or replace
                the physical fingerprint template stored in the
                sensor.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn-secondary disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={
            saving ||
            employeesLoading ||
            (!editing && employees.length === 0)
          }
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              {editing ? 'Updating...' : 'Starting Enrollment...'}
            </>
          ) : (
            <>
              <Fingerprint size={16} />
              {editing ? 'Update' : 'Enroll'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
