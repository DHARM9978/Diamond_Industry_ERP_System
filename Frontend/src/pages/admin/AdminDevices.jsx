import { useEffect, useState } from 'react';
import {
  Cpu,
  RefreshCw,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';
import { deviceService } from '@/services/apiServices';

export function AdminDevices() {
  const { toast } = useToast();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

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
      label: 'Registered',
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
          <button
            type="button"
            onClick={loadDevices}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      <div className="mb-5 rounded-lg border border-navy-100 bg-navy-50 p-4">
        <div className="flex items-start gap-3">
          <Cpu
            size={20}
            className="text-navy-600 mt-0.5"
          />

          <div>
            <p className="text-sm font-medium text-navy-800">
              Device management
            </p>

            <p className="text-xs text-navy-500 mt-1 leading-relaxed">
              Fingerprint devices are managed by the
              system provider. You can view the registered
              devices and their current connection status,
              but device registration and configuration
              changes are not available to this account.
            </p>
          </div>
        </div>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices"
          message="No fingerprint devices are currently registered for your company."
        />
      ) : (
        <DataTable
          columns={columns}
          data={devices}
        />
      )}
    </div>
  );
}