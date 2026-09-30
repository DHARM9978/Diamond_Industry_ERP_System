import { useEffect, useState } from 'react';

import {
  Cpu,
  RefreshCw,
  Wifi,
  Save,
  X,
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

import {
  formatISTDateTime,
} from '@/utils/dateTime';

export function AdminDevices() {
  const { toast } = useToast();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [wifiDevice, setWifiDevice] = useState(null);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiSaving, setWifiSaving] = useState(false);

  const [wifiForm, setWifiForm] = useState({
    primarySsid: '',
    primaryPassword: '',
    secondarySsid: '',
    secondaryPassword: '',
  });

  const [wifiMetadata, setWifiMetadata] = useState(null);

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
  // FORMAT DATE/TIME IN IST
  // ==================================================

  const formatDateTime = (date) => {
    if (!date) {
      return '—';
    }

    const formatted =
      formatISTDateTime(
        date,
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }
      );

    return formatted === '—'
      ? '—'
      : formatted;
  };

  // ==================================================
  // LOAD WI-FI CONFIGURATION METADATA
  // ==================================================

  const openWifiConfiguration = async (device) => {
    try {
      setWifiDevice(device);
      setWifiLoading(true);
      setWifiMetadata(null);

      /*
       * Passwords are intentionally not returned by the
       * backend. Opening this form therefore starts with
       * empty password fields.
       *
       * The backend returns only Wi-Fi configuration
       * metadata/status for the administrator.
       */

      setWifiForm({
        primarySsid: '',
        primaryPassword: '',
        secondarySsid: '',
        secondaryPassword: '',
      });

      const response =
        await deviceService.getWifi(
          device.deviceId
        );

      const metadata =
        response?.data ||
        response ||
        {};

      setWifiMetadata(metadata);

    } catch (error) {

      console.error(
        'Failed to load Wi-Fi configuration:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load Wi-Fi configuration',
        'error'
      );

      setWifiDevice(null);
      setWifiMetadata(null);

    } finally {

      setWifiLoading(false);

    }
  };

  // ==================================================
  // CLOSE WI-FI CONFIGURATION
  // ==================================================

  const closeWifiConfiguration = () => {
    if (wifiSaving) {
      return;
    }

    setWifiDevice(null);
    setWifiMetadata(null);

    setWifiForm({
      primarySsid: '',
      primaryPassword: '',
      secondarySsid: '',
      secondaryPassword: '',
    });
  };

  // ==================================================
  // WI-FI FORM CHANGE
  // ==================================================

  const handleWifiChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setWifiForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // ==================================================
  // SAVE WI-FI CONFIGURATION
  // ==================================================

  const saveWifiConfiguration = async (event) => {
    event.preventDefault();

    if (!wifiDevice) {
      return;
    }

    if (!wifiForm.primarySsid.trim()) {
      toast(
        'Primary Wi-Fi SSID is required',
        'error'
      );
      return;
    }

    if (
      !wifiForm.primaryPassword ||
      wifiForm.primaryPassword.length < 8 ||
      wifiForm.primaryPassword.length > 63
    ) {
      toast(
        'Primary Wi-Fi password must be between 8 and 63 characters',
        'error'
      );
      return;
    }

    const hasSecondary =
      Boolean(
        wifiForm.secondarySsid.trim() ||
        wifiForm.secondaryPassword
      );

    if (hasSecondary) {

      if (!wifiForm.secondarySsid.trim()) {
        toast(
          'Secondary Wi-Fi SSID is required when a secondary password is provided',
          'error'
        );
        return;
      }

      if (
        !wifiForm.secondaryPassword ||
        wifiForm.secondaryPassword.length < 8 ||
        wifiForm.secondaryPassword.length > 63
      ) {
        toast(
          'Secondary Wi-Fi password must be between 8 and 63 characters',
          'error'
        );
        return;
      }
    }

    try {
      setWifiSaving(true);

      /*
       * IMPORTANT:
       *
       * The backend device.service.js expects these
       * exact top-level field names:
       *
       * primarySsid
       * primaryPassword
       * secondarySsid
       * secondaryPassword
       *
       * Do not send nested "primary" / "secondary"
       * objects here.
       */

      const payload = {
        primarySsid:
          wifiForm.primarySsid.trim(),

        primaryPassword:
          wifiForm.primaryPassword,

        secondarySsid:
          hasSecondary
            ? wifiForm.secondarySsid.trim()
            : '',

        secondaryPassword:
          hasSecondary
            ? wifiForm.secondaryPassword
            : '',
      };

      const response =
        await deviceService.setWifi(
          wifiDevice.deviceId,
          payload
        );

      const result =
        response?.data ||
        response ||
        {};

      setWifiMetadata((current) => ({
        ...(current || {}),
        ...result,
      }));

      toast(
        'Wi-Fi configuration saved and is pending device application',
        'success'
      );

      /*
       * Do not keep passwords in the form after the
       * request has completed.
       */
      setWifiForm({
        primarySsid: '',
        primaryPassword: '',
        secondarySsid: '',
        secondaryPassword: '',
      });

    } catch (error) {

      console.error(
        'Failed to save Wi-Fi configuration:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to save Wi-Fi configuration',
        'error'
      );

    } finally {

      setWifiSaving(false);

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

    {
      key: 'wifi',
      label: 'Wi-Fi',
      align: 'center',

      render: (device) => (

        <button
          type="button"
          onClick={() =>
            openWifiConfiguration(device)
          }
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors text-sm"
        >

          <Wifi size={15} />

          Configure

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

              Fingerprint devices are managed from this
              page. You can view registered devices,
              connection status, and configure the Wi-Fi
              networks that an ESP32 device should use.

              Wi-Fi passwords are sent securely to the
              backend and are never returned to this page.

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

      {/* ==================================================
          WI-FI CONFIGURATION MODAL
          ================================================== */}

      {wifiDevice && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">

              <div>

                <div className="flex items-center gap-2">

                  <Wifi
                    size={20}
                    className="text-navy-700"
                  />

                  <h2 className="text-lg font-semibold text-navy-900">

                    Wi-Fi Configuration

                  </h2>

                </div>

                <p className="text-xs text-navy-500 mt-1">

                  {wifiDevice.deviceName ||
                    'Unnamed Device'}

                  {' · '}

                  {wifiDevice.deviceCode ||
                    wifiDevice.deviceId}

                </p>

              </div>

              <button
                type="button"
                onClick={closeWifiConfiguration}
                disabled={wifiSaving}
                className="p-2 rounded-lg text-navy-500 hover:bg-navy-50 hover:text-navy-800 disabled:opacity-50"
              >

                <X size={20} />

              </button>

            </div>

            {wifiLoading ? (

              <div className="px-6 py-10 text-center text-sm text-navy-500">

                Loading Wi-Fi configuration status...

              </div>

            ) : (

              <form
                onSubmit={saveWifiConfiguration}
                className="px-6 py-5"
              >

                <div className="mb-5 rounded-lg border border-navy-100 bg-navy-50 p-4">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div>

                      <p className="text-xs text-navy-500">
                        Configuration Status
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1">

                        {wifiMetadata?.wifiConfigStatus ||
                          'NOT_CONFIGURED'}

                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-navy-500">
                        Configuration Version
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1">

                        {wifiMetadata?.wifiConfigVersion ??
                          0}

                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-navy-500">
                        Active Network
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1">

                        {wifiMetadata?.wifiActiveNetwork ||
                          '—'}

                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-navy-500">
                        Last Wi-Fi Error
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1 break-words">

                        {wifiMetadata?.wifiLastError ||
                          '—'}

                      </p>

                    </div>

                  </div>

                </div>

                <div className="mb-5 rounded-lg border border-amber-100 bg-amber-50 p-4">

                  <p className="text-sm font-medium text-amber-900">

                    Security notice

                  </p>

                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">

                    Existing Wi-Fi passwords cannot be
                    displayed or recovered from this page.
                    Enter the password again when changing
                    a network configuration.

                  </p>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div className="rounded-lg border border-navy-100 p-4">

                    <h3 className="text-sm font-semibold text-navy-900 mb-4">

                      Primary Wi-Fi

                    </h3>

                    <label className="block text-xs font-medium text-navy-700 mb-1">

                      SSID

                    </label>

                    <input
                      type="text"
                      name="primarySsid"
                      value={wifiForm.primarySsid}
                      onChange={handleWifiChange}
                      autoComplete="off"
                      className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                      placeholder="Primary Wi-Fi network"
                    />

                    <label className="block text-xs font-medium text-navy-700 mb-1 mt-4">

                      Password

                    </label>

                    <input
                      type="password"
                      name="primaryPassword"
                      value={wifiForm.primaryPassword}
                      onChange={handleWifiChange}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                      placeholder="Enter primary password"
                    />

                  </div>

                  <div className="rounded-lg border border-navy-100 p-4">

                    <h3 className="text-sm font-semibold text-navy-900 mb-4">

                      Secondary Wi-Fi

                      <span className="text-xs font-normal text-navy-400 ml-2">

                        Optional

                      </span>

                    </h3>

                    <label className="block text-xs font-medium text-navy-700 mb-1">

                      SSID

                    </label>

                    <input
                      type="text"
                      name="secondarySsid"
                      value={wifiForm.secondarySsid}
                      onChange={handleWifiChange}
                      autoComplete="off"
                      className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                      placeholder="Secondary Wi-Fi network"
                    />

                    <label className="block text-xs font-medium text-navy-700 mb-1 mt-4">

                      Password

                    </label>

                    <input
                      type="password"
                      name="secondaryPassword"
                      value={wifiForm.secondaryPassword}
                      onChange={handleWifiChange}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                      placeholder="Enter secondary password"
                    />

                  </div>

                </div>

                <div className="flex items-center justify-end gap-3 mt-6">

                  <button
                    type="button"
                    onClick={closeWifiConfiguration}
                    disabled={wifiSaving}
                    className="px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
                  >

                    Cancel

                  </button>

                  <button
                    type="submit"
                    disabled={wifiSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 text-white hover:bg-navy-900 transition-colors disabled:opacity-50"
                  >

                    <Save size={16} />

                    {wifiSaving
                      ? 'Saving...'
                      : 'Save Wi-Fi Configuration'}

                  </button>

                </div>

              </form>

            )}

          </div>

        </div>

      )}

    </div>

  );

}