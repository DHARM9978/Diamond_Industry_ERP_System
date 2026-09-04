import { useEffect, useMemo, useState } from 'react';
import {
  Fingerprint,
  Plus,
  Pencil,
  RefreshCw,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { fingerprintService } from '@/services/apiServices';

export function AdminFingerprints() {
  const { toast } = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // --------------------------------------------------
  // LOAD FINGERPRINTS
  // --------------------------------------------------

  const loadFingerprints = async () => {
    try {
      setLoading(true);

      const response =
        await fingerprintService.list();

      let fingerprintRecords = [];

      if (Array.isArray(response)) {
        fingerprintRecords = response;
      } else if (
        Array.isArray(response?.data)
      ) {
        fingerprintRecords = response.data;
      }

      setRecords(fingerprintRecords);
    } catch (error) {
      console.error(
        'Failed to load fingerprints:',
        error
      );

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

  useEffect(() => {
    loadFingerprints();
  }, []);

  // --------------------------------------------------
  // EMPLOYEE NAME
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
  // FORMAT DATE
  // --------------------------------------------------

  const formatDate = (date) => {
    if (!date) {
      return '—';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    return parsedDate.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  // --------------------------------------------------
  // SEARCH
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

      const fingerName =
        String(
          record?.fingerName ?? ''
        ).toLowerCase();

      const sensorSlot =
        String(
          record?.sensorSlot ?? ''
        ).toLowerCase();

      const templateId =
        String(
          record?.templateId ?? ''
        ).toLowerCase();

      const status =
        String(
          record?.status ?? ''
        ).toLowerCase();

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

  // --------------------------------------------------
  // SAVE FINGERPRINT
  // --------------------------------------------------

  const handleSave = async (form) => {
    try {
      setSaving(true);

      const payload = {
        employeeId: Number(
          form.employeeId
        ),

        sensorSlot: Number(
          form.sensorSlot
        ),

        fingerName:
          form.fingerName.trim(),
      };

      // -------------------------------
      // EDIT
      // -------------------------------

      if (editing) {
        const response =
          await fingerprintService.update(
            editing.templateId,
            payload
          );

        const updatedRecord =
          response?.data || response;

        setRecords((prev) =>
          prev.map((record) =>
            record.templateId ===
            editing.templateId
              ? {
                  ...record,
                  ...updatedRecord,
                  employee:
                    updatedRecord.employee ||
                    record.employee,
                }
              : record
          )
        );

        toast(
          'Fingerprint updated successfully',
          'success'
        );
      }

      // -------------------------------
      // CREATE
      // -------------------------------

      else {
        const response =
          await fingerprintService.create(
            payload
          );

        const newRecord =
          response?.data || response;

        /*
         * Add the actual record returned by
         * the backend.
         */

        setRecords((prev) => [
          newRecord,
          ...prev,
        ]);

        toast(
          'Fingerprint enrolled successfully',
          'success'
        );
      }

      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      console.error(
        'Fingerprint save error:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to save fingerprint',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // TABLE COLUMNS
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
        <StatusBadge
          status={record.status}
        />
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

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading fingerprints..."
      />
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Fingerprints"
        subtitle={`${filtered.length} record${
          filtered.length !== 1
            ? 's'
            : ''
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

      {/* Search + Refresh */}
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

      {/* Table */}
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
        <DataTable
          columns={columns}
          data={filtered}
        />
      )}

      {/* Enroll / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        title={
          editing
            ? 'Edit Fingerprint'
            : 'Enroll Fingerprint'
        }
      >
        <FingerprintForm
          editing={editing}
          saving={saving}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      </Modal>
    </div>
  );
}

// ======================================================
// FINGERPRINT FORM
// ======================================================

function FingerprintForm({
  editing,
  saving,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState({
    employeeId:
      editing?.employeeId
        ? String(editing.employeeId)
        : '',

    sensorSlot:
      editing?.sensorSlot
        ? String(editing.sensorSlot)
        : '',

    fingerName:
      editing?.fingerName ||
      'Right Index',
  });

  const handleChange = (
    field,
    value
  ) => {
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
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/* Employee ID */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Employee ID
        </label>

        <input
          type="number"
          min="1"
          className="input-field"
          value={form.employeeId}
          onChange={(event) =>
            handleChange(
              'employeeId',
              event.target.value
            )
          }
          placeholder="Enter employee ID"
          required
          disabled={saving}
        />

        <p className="text-xs text-navy-400">
          Enter the employee ID that will be
          associated with this fingerprint.
        </p>
      </div>

      {/* Sensor Slot */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Sensor Slot
        </label>

        <input
          type="number"
          min="1"
          className="input-field"
          value={form.sensorSlot}
          onChange={(event) =>
            handleChange(
              'sensorSlot',
              event.target.value
            )
          }
          placeholder="Example: 8"
          required
          disabled={saving}
        />

        <p className="text-xs text-navy-400">
          Use the same slot that will be stored
          on the fingerprint sensor.
        </p>
      </div>

      {/* Finger */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Finger
        </label>

        <select
          className="input-field"
          value={form.fingerName}
          onChange={(event) =>
            handleChange(
              'fingerName',
              event.target.value
            )
          }
          disabled={saving}
        >
          <option value="Right Thumb">
            Right Thumb
          </option>

          <option value="Left Thumb">
            Left Thumb
          </option>

          <option value="Right Index">
            Right Index
          </option>

          <option value="Left Index">
            Left Index
          </option>

          <option value="Right Middle">
            Right Middle
          </option>

          <option value="Left Middle">
            Left Middle
          </option>

          <option value="Right Ring">
            Right Ring
          </option>

          <option value="Left Ring">
            Left Ring
          </option>

          <option value="Right Pinky">
            Right Pinky
          </option>

          <option value="Left Pinky">
            Left Pinky
          </option>
        </select>
      </div>

      {/* Information */}
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
                First choose the employee and
                sensor slot. The fingerprint
                must then be enrolled on the
                connected fingerprint device
                using the same sensor slot.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
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
          disabled={saving}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <RefreshCw
                size={16}
                className="animate-spin"
              />
              Saving...
            </>
          ) : (
            <>
              <Fingerprint size={16} />
              {editing
                ? 'Update'
                : 'Enroll'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}