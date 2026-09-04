import { useEffect, useState } from 'react';
import {
  Cpu,
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
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { deviceService } from '@/services/apiServices';

export function AdminDevices() {
  const { toast } = useToast();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // ==================================================
  // LOAD DEVICES
  // ==================================================

  const loadDevices = async () => {
    try {
      setLoading(true);

      const response =
        await deviceService.list();

      /*
       * Backend:
       *
       * {
       *   success: true,
       *   message: "Devices fetched successfully",
       *   data: [...]
       * }
       */

      let deviceData = [];

      if (Array.isArray(response)) {
        deviceData = response;
      } else if (
        Array.isArray(response?.data)
      ) {
        deviceData = response.data;
      }

      setDevices(deviceData);
    } catch (error) {
      console.error(
        'Failed to load devices:',
        error
      );

      setDevices([]);

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load devices',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // ==================================================
  // FORMAT DATE
  // ==================================================

  const formatDateTime = (date) => {
    if (!date) {
      return '—';
    }

    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return '—';
    }

    return parsedDate.toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };

  // ==================================================
  // SAVE DEVICE
  // ==================================================

  const handleSave = async (form) => {
    try {
      setSaving(true);

      const payload = {
        deviceCode:
          form.deviceCode.trim(),

        deviceName:
          form.deviceName.trim(),

        branchId: Number(
          form.branchId
        ),

        location:
          form.location.trim(),
      };

      // ==================================================
      // UPDATE
      // ==================================================

      if (editing) {
        const response =
          await deviceService.update(
            editing.deviceId,
            payload
          );

        /*
         * Depending on apiServices.js this can
         * be either:
         *
         * response.data
         * or
         * response
         */

        const updatedDevice =
          response?.data ||
          response;

        setDevices((prev) =>
          prev.map((device) =>
            device.deviceId ===
            editing.deviceId
              ? {
                  ...device,
                  ...updatedDevice,
                }
              : device
          )
        );

        toast(
          'Device updated successfully',
          'success'
        );
      }

      // ==================================================
      // CREATE
      // ==================================================

      else {
        const response =
          await deviceService.create(
            payload
          );

        const newDevice =
          response?.data ||
          response;

        setDevices((prev) => [
          newDevice,
          ...prev,
        ]);

        toast(
          'Device added successfully',
          'success'
        );
      }

      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      console.error(
        'Device save error:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to save device',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // ==================================================
  // TABLE
  // ==================================================

  const columns = [
    {
      key: 'deviceName',
      label: 'Device',

      render: (device) => (
        <div>
          <div className="font-medium text-navy-900">
            {device.deviceName ||
              'Unnamed Device'}
          </div>

          <div className="text-xs text-navy-400 mt-1">
            ID: {device.deviceId}
          </div>
        </div>
      ),
    },

    {
      key: 'deviceCode',
      label: 'Serial',

      render: (device) => (
        <span className="font-mono text-xs text-navy-500">
          {device.deviceCode || '—'}
        </span>
      ),
    },

    {
      key: 'model',
      label: 'Model',

      render: () => (
        <span className="text-navy-600">
          ESP32
        </span>
      ),
    },

    {
      key: 'location',
      label: 'Location',

      render: (device) => (
        <span className="text-navy-600">
          {device.location ||
            device.branch?.branchName ||
            '—'}
        </span>
      ),
    },

    {
      key: 'enrolled',
      label: 'Enrolled',
      align: 'center',

      render: (device) => (
        <span className="text-navy-500">
          {formatDateTime(
            device.createdAt
          )}
        </span>
      ),
    },

    {
      key: 'lastSeenAt',
      label: 'Last Sync',

      render: (device) => (
        <span className="text-navy-500 text-sm">
          {formatDateTime(
            device.lastSeenAt
          )}
        </span>
      ),
    },

    {
      key: 'status',
      label: 'Status',
      align: 'center',

      render: (device) => (
        <StatusBadge
          status={device.status}
        />
      ),
    },

    {
      key: 'actions',
      label: '',
      align: 'right',

      render: (device) => (
        <button
          type="button"
          onClick={() => {
            setEditing(device);
            setModalOpen(true);
          }}
          className="p-2 rounded-lg text-navy-400 hover:bg-navy-100 hover:text-navy-700 transition-colors"
          title="Edit device"
        >
          <Pencil size={16} />
        </button>
      ),
    },
  ];

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading devices..."
      />
    );
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <div>
      <PageHeader
        title="Fingerprint Devices"
        subtitle={`${devices.length} device${
          devices.length !== 1
            ? 's'
            : ''
        }`}
        actions={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadDevices}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={18} />
              Add Device
            </button>
          </div>
        }
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices"
          message="Add fingerprint devices to track attendance."
        />
      ) : (
        <DataTable
          columns={columns}
          data={devices}
        />
      )}

      {/* ==================================================
          ADD / EDIT DEVICE MODAL
          ================================================== */}

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
            ? 'Edit Device'
            : 'Add Device'
        }
      >
        <DeviceForm
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
// DEVICE FORM
// ======================================================

function DeviceForm({
  editing,
  saving,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState({
    deviceCode:
      editing?.deviceCode || '',

    deviceName:
      editing?.deviceName || '',

    branchId:
      editing?.branchId
        ? String(editing.branchId)
        : '1',

    location:
      editing?.location || '',
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
      {/* DEVICE CODE */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Device Code
        </label>

        <input
          className="input-field"
          value={form.deviceCode}
          onChange={(event) =>
            handleChange(
              'deviceCode',
              event.target.value
            )
          }
          placeholder="Example: ESP32-002"
          required
          disabled={saving}
        />

        <p className="text-xs text-navy-400">
          Unique identifier for the fingerprint
          device.
        </p>
      </div>

      {/* DEVICE NAME */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Device Name
        </label>

        <input
          className="input-field"
          value={form.deviceName}
          onChange={(event) =>
            handleChange(
              'deviceName',
              event.target.value
            )
          }
          placeholder="Example: Main Fingerprint Machine"
          required
          disabled={saving}
        />
      </div>

      {/* BRANCH ID */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Branch ID
        </label>

        <input
          type="number"
          min="1"
          className="input-field"
          value={form.branchId}
          onChange={(event) =>
            handleChange(
              'branchId',
              event.target.value
            )
          }
          placeholder="Example: 1"
          required
          disabled={saving}
        />

        <p className="text-xs text-navy-400">
          Branch where this fingerprint machine
          is installed.
        </p>
      </div>

      {/* LOCATION */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-navy-700">
          Location
        </label>

        <input
          className="input-field"
          value={form.location}
          onChange={(event) =>
            handleChange(
              'location',
              event.target.value
            )
          }
          placeholder="Example: Main Branch"
          required
          disabled={saving}
        />
      </div>

      {/* INFO */}
      {!editing && (
        <div className="rounded-lg bg-navy-50 border border-navy-100 p-4">
          <div className="flex items-start gap-3">
            <Cpu
              size={20}
              className="text-navy-600 mt-0.5"
            />

            <div>
              <p className="text-sm font-medium text-navy-800">
                Device registration
              </p>

              <p className="text-xs text-navy-500 mt-1 leading-relaxed">
                This registers the ESP32
                fingerprint machine with the ERP
                backend. The device must use its
                configured device credentials when
                communicating with the backend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BUTTONS */}
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
              <Cpu size={16} />
              {editing
                ? 'Update Device'
                : 'Add Device'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}