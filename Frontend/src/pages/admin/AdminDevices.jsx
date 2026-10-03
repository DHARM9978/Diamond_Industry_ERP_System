import { useEffect, useState } from 'react';

import {
  Cpu,
  RefreshCw,
  Wifi,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
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

  const [wifiProfile, setWifiProfile] = useState('PRIMARY');

  /*
   * Wi-Fi application progress
   *
   * After the backend accepts a configuration change, keep the
   * administrator on this page and follow the device until the
   * requested configuration version is APPLIED or FAILED.
   */
  const [wifiApply, setWifiApply] = useState({
    active: false,
    profile: 'PRIMARY',
    ssid: '',
    targetVersion: null,
    status: 'IDLE',
    stage: 0,
    error: null,
    logs: [],
  });

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
       * backend. SSIDs are safe metadata and are loaded
       * into the editable fields so the administrator can
       * see and change the current network name.
       */

      setWifiProfile('PRIMARY');
      setWifiApply({
        active: false,
        profile: 'PRIMARY',
        ssid: '',
        targetVersion: null,
        status: 'IDLE',
        stage: 0,
        error: null,
      });

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

      setWifiForm({
        primarySsid:
          metadata?.primarySsid ||
          metadata?.wifiPrimarySsid ||
          '',
        primaryPassword: '',
        secondarySsid:
          metadata?.secondarySsid ||
          metadata?.wifiSecondarySsid ||
          '',
        secondaryPassword: '',
      });

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
    setWifiProfile('PRIMARY');
    setWifiApply({
      active: false,
      profile: 'PRIMARY',
      ssid: '',
      targetVersion: null,
      status: 'IDLE',
      stage: 0,
      error: null,
      logs: [],
    });

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

    const isPrimary = wifiProfile === 'PRIMARY';

    const ssid = isPrimary
      ? wifiForm.primarySsid.trim()
      : wifiForm.secondarySsid.trim();

    const password = isPrimary
      ? wifiForm.primaryPassword
      : wifiForm.secondaryPassword;

    if (!ssid) {
      toast(
        `${isPrimary ? 'Primary' : 'Secondary'} Wi-Fi SSID is required`,
        'error'
      );
      return;
    }

    if (!password || password.length < 8 || password.length > 63) {
      toast(
        `${isPrimary ? 'Primary' : 'Secondary'} Wi-Fi password must be between 8 and 63 characters`,
        'error'
      );
      return;
    }

    try {
      setWifiSaving(true);

      /*
       * The backend supports selective Wi-Fi profile updates.
       *
       * Send only the profile that the administrator is changing.
       * The backend preserves the other stored profile.
       */
      const payload = {
        profile: wifiProfile,
        ssid,
        password,
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

      const targetVersion =
        Number(
          result?.wifiConfigVersion ??
            result?.configVersion ??
            0
        ) || null;

      setWifiMetadata((current) => ({
        ...(current || {}),
        ...result,
      }));

      /*
       * Do not keep the password in the form after the
       * request has completed.
       */
      setWifiForm((current) => ({
        ...current,
        primaryPassword: '',
        secondaryPassword: '',
      }));

      /*
       * Switch from the editable form to a device-application
       * progress screen. The screen remains open while the ESP32
       * receives, tests, and applies the new configuration.
       */
      setWifiApply({
        active: true,
        profile: wifiProfile,
        ssid,
        targetVersion,
        status: 'PENDING',
        stage: 1,
        error: null,
      });

      toast(
        `${isPrimary ? 'Primary' : 'Secondary'} Wi-Fi configuration sent to the device`,
        'success'
      );

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

  /*
   * Follow the Wi-Fi configuration version after the backend
   * accepts the change. This lets the UI distinguish:
   *
   * PENDING  -> device has not finished applying it yet
   * APPLIED  -> device acknowledged the requested version
   * FAILED   -> device rejected/failed the requested version
   */
  useEffect(() => {
    if (!wifiDevice || !wifiApply.active) {
      return undefined;
    }

    let cancelled = false;

    const pollWifiApplication = async () => {
      try {
        const wifiResponse =
          await deviceService.getWifi(
            wifiDevice.deviceId
          );

        if (cancelled) {
          return;
        }

        const metadata =
          wifiResponse?.data ||
          wifiResponse ||
          {};

        setWifiMetadata(metadata);

        const targetVersion =
          Number(wifiApply.targetVersion) || 0;

        const currentVersion =
          Number(metadata?.wifiConfigVersion) || 0;

        const status =
          String(
            metadata?.wifiConfigStatus ||
              'PENDING'
          ).toUpperCase();

        /*
         * The backend currently gives us the configuration
         * version and final APPLIED/FAILED state, but it does
         * not expose each internal ESP32 Wi-Fi step as a
         * separate persisted status.
         *
         * Therefore:
         * - PENDING keeps the progress indicator active.
         * - APPLIED marks every verified step complete.
         * - FAILED marks the process failed without claiming
         *   that an individual internal step completed.
         */
        let stage = 1;

        if (
          status === 'APPLIED' &&
          targetVersion > 0 &&
          currentVersion >= targetVersion
        ) {
          stage = 5;
        } else if (status === 'FAILED') {
          stage = 6;
        }

        setWifiApply((current) => ({
          ...current,
          status,
          stage,
          error:
            status === 'FAILED'
              ? metadata?.wifiLastError ||
                'The device failed to apply the Wi-Fi configuration.'
              : null,
          }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setWifiApply((current) => ({
          ...current,
          error:
            current.status === 'FAILED'
              ? current.error
              : null,
        }));
      }
    };

    pollWifiApplication();

    const intervalId = setInterval(
      pollWifiApplication,
      2000
    );

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [
    wifiDevice,
    wifiApply.active,
    wifiApply.targetVersion,
  ]);


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

        <div className="flex items-center justify-center gap-2">

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

        </div>

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

      <div className="mb-3 rounded-lg border border-navy-100 bg-navy-50 p-3">

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

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-3 overflow-hidden">

          <div className="w-full max-w-2xl max-h-[calc(100vh-24px)] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col">

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
                disabled={wifiSaving || wifiApply.active}
                className="p-2 rounded-lg text-navy-500 hover:bg-navy-50 hover:text-navy-800 disabled:opacity-50"
              >

                <X size={20} />

              </button>

            </div>

            {wifiLoading ? (

              <div className="px-6 py-10 text-center text-sm text-navy-500">

                Loading Wi-Fi configuration status...

              </div>

            ) : wifiApply.active ? (

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5">

                <div className="rounded-lg border border-navy-100 bg-navy-50 p-4">

                  <div className="flex items-center gap-3">

                    {wifiApply.status === 'APPLIED' ? (
                      <CheckCircle2
                        size={30}
                        className="text-green-600 shrink-0"
                      />
                    ) : wifiApply.status === 'FAILED' ? (
                      <AlertCircle
                        size={30}
                        className="text-red-600 shrink-0"
                      />
                    ) : (
                      <LoaderCircle
                        size={30}
                        className="text-navy-700 shrink-0 animate-spin"
                      />
                    )}

                    <div>

                      <h3 className="text-base font-semibold text-navy-900">

                        {wifiApply.status === 'APPLIED'
                          ? 'Wi-Fi configuration applied'
                          : wifiApply.status === 'FAILED'
                            ? 'Wi-Fi configuration failed'
                            : 'Wi-Fi configuration in progress'}

                      </h3>

                      <p className="text-sm text-navy-500 mt-1">

                        {wifiApply.profile === 'PRIMARY'
                          ? 'Primary Wi-Fi'
                          : 'Secondary Wi-Fi'}

                        {' · '}

                        {wifiApply.ssid}

                      </p>

                    </div>

                  </div>

                </div>

                <div className="mt-5 rounded-lg border border-navy-100 p-4">

                  <p className="text-sm font-semibold text-navy-900">

                    Device Activity

                  </p>

                  <p className="text-xs text-navy-500 mt-1">

                    Live progress from the fingerprint machine

                  </p>

                  <div className="mt-4 space-y-3">

                    {[
                      {
                        number: 1,
                        title: 'Configuration sent to device',
                        description: 'The ERP has created the requested Wi-Fi configuration.',
                      },
                      {
                        number: 2,
                        title: 'Connecting to selected Wi-Fi',
                        description: 'The ESP32 is attempting to connect using the new network details.',
                      },
                      {
                        number: 3,
                        title: 'Testing ERP connection',
                        description: 'The device verifies that it can communicate with the ERP backend.',
                      },
                      {
                        number: 4,
                        title: 'Committing configuration',
                        description: 'The device stores the verified configuration and reports the result.',
                      },
                      {
                        number: 5,
                        title: 'Configuration applied',
                        description: 'The device acknowledged the requested configuration version.',
                      },
                    ].map((item) => {
                      const complete =
                        wifiApply.stage > item.number ||
                        (
                          item.number === 5 &&
                          wifiApply.status === 'APPLIED'
                        );

                      const current =
                        wifiApply.stage === item.number &&
                        wifiApply.status !== 'APPLIED' &&
                        wifiApply.status !== 'FAILED';

                      return (
                        <div
                          key={item.number}
                          className="flex items-start gap-3"
                        >

                          <div className="mt-0.5 shrink-0">

                            {complete ? (
                              <CheckCircle2
                                size={20}
                                className="text-green-600"
                              />
                            ) : current ? (
                              <LoaderCircle
                                size={20}
                                className="text-navy-700 animate-spin"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-navy-200 flex items-center justify-center">

                                <span className="text-[10px] text-navy-400">
                                  {item.number}
                                </span>

                              </div>
                            )}

                          </div>

                          <div className="min-w-0">

                            <p className="text-sm font-medium text-navy-800">

                              {item.title}

                            </p>

                            <p className="text-xs text-navy-500 mt-0.5">

                              {item.description}

                            </p>

                          </div>

                        </div>
                      );
                    })}

                  </div>

                </div>

                <div className="mt-5 rounded-lg border border-navy-100 bg-navy-50 p-4">

                  <div className="flex items-start gap-3">

                    {wifiApply.status === 'APPLIED' ? (
                      <CheckCircle2
                        size={20}
                        className="text-green-600 mt-0.5 shrink-0"
                      />
                    ) : wifiApply.status === 'FAILED' ? (
                      <AlertCircle
                        size={20}
                        className="text-red-600 mt-0.5 shrink-0"
                      />
                    ) : (
                      <LoaderCircle
                        size={20}
                        className="text-navy-700 mt-0.5 shrink-0 animate-spin"
                      />
                    )}

                    <div>

                      <p className="text-sm font-semibold text-navy-900">

                        {wifiApply.status === 'APPLIED'
                          ? 'Device has completed the Wi-Fi change'
                          : wifiApply.status === 'FAILED'
                            ? 'Device could not complete the Wi-Fi change'
                            : 'Waiting for the device to complete the Wi-Fi change'}

                      </p>

                      <p className="text-xs text-navy-500 mt-1 leading-relaxed">

                        {wifiApply.status === 'APPLIED'
                          ? 'All Wi-Fi configuration steps have been acknowledged by the device.'
                          : wifiApply.status === 'FAILED'
                            ? 'The previous Wi-Fi configuration remains in effect unless the device reports otherwise.'
                            : 'The device is applying and verifying the new Wi-Fi configuration. This window will update automatically.'}

                      </p>

                    </div>

                  </div>

                </div>

                {wifiApply.status === 'FAILED' && (

                  <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3">

                    <p className="text-sm font-medium text-red-800">

                      Configuration could not be applied

                    </p>

                    <p className="text-xs text-red-700 mt-1 break-words">

                      {wifiApply.error ||
                        'The device reported a Wi-Fi configuration failure.'}

                    </p>

                  </div>

                )}

                {wifiApply.status === 'APPLIED' && (

                  <div className="mt-4 rounded-lg border border-green-100 bg-green-50 p-3">

                    <p className="text-sm font-medium text-green-800">

                      Wi-Fi configuration completed successfully.

                    </p>

                    <p className="text-xs text-green-700 mt-1">

                      The device has acknowledged configuration version{' '}

                      {wifiApply.targetVersion ?? wifiMetadata?.wifiConfigVersion ?? '—'}.

                    </p>

                  </div>

                )}

                <div className="flex items-center justify-end gap-3 mt-5">

                  <button
                    type="button"
                    onClick={() => {
                      if (wifiApply.status === 'APPLIED' || wifiApply.status === 'FAILED') {
                        closeWifiConfiguration();
                      }
                    }}
                    disabled={
                      wifiApply.status !== 'APPLIED' &&
                      wifiApply.status !== 'FAILED'
                    }
                    className="px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
                  >

                    {wifiApply.status === 'APPLIED' || wifiApply.status === 'FAILED'
                      ? 'Close'
                      : 'Waiting for device...'}

                  </button>

                </div>

              </div>

            ) : (

              <form
                onSubmit={saveWifiConfiguration}
                className="px-6 py-3 flex-1 min-h-0 overflow-y-auto overscroll-contain"
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
                        Active SSID
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1 break-words">

                        {wifiMetadata?.wifiActiveSsid ||
                          '—'}

                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-navy-500">
                        Primary Wi-Fi
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1 break-words">

                        {wifiMetadata?.primarySsid ||
                          wifiMetadata?.wifiPrimarySsid ||
                          '—'}

                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-navy-500">
                        Secondary Wi-Fi
                      </p>

                      <p className="text-sm font-medium text-navy-800 mt-1 break-words">

                        {wifiMetadata?.secondarySsid ||
                          wifiMetadata?.wifiSecondarySsid ||
                          '—'}

                      </p>

                    </div>

                    <div className="sm:col-span-2">

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

                <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3">

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

                <div className="mb-3">

                  <p className="text-sm font-medium text-navy-800 mb-3">

                    Select network to change

                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <label
                      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                        wifiProfile === 'PRIMARY'
                          ? 'border-navy-500 bg-navy-50'
                          : 'border-navy-100 hover:bg-navy-50'
                      }`}
                    >

                      <div className="flex items-start gap-3">

                        <input
                          type="radio"
                          name="wifiProfile"
                          value="PRIMARY"
                          checked={wifiProfile === 'PRIMARY'}
                          onChange={(event) =>
                            setWifiProfile(event.target.value)
                          }
                          className="mt-1"
                        />

                        <div>

                          <p className="text-sm font-semibold text-navy-900">

                            Primary Wi-Fi

                          </p>

                          <p className="text-xs text-navy-500 mt-1">

                            Main network used by the device.

                          </p>

                        </div>

                      </div>

                    </label>

                    <label
                      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                        wifiProfile === 'SECONDARY'
                          ? 'border-navy-500 bg-navy-50'
                          : 'border-navy-100 hover:bg-navy-50'
                      }`}
                    >

                      <div className="flex items-start gap-3">

                        <input
                          type="radio"
                          name="wifiProfile"
                          value="SECONDARY"
                          checked={wifiProfile === 'SECONDARY'}
                          onChange={(event) =>
                            setWifiProfile(event.target.value)
                          }
                          className="mt-1"
                        />

                        <div>

                          <p className="text-sm font-semibold text-navy-900">

                            Secondary Wi-Fi

                          </p>

                          <p className="text-xs text-navy-500 mt-1">

                            Backup network used during failover.

                          </p>

                        </div>

                      </div>

                    </label>

                  </div>

                </div>

                <div className="rounded-lg border border-navy-100 p-3">

                  <h3 className="text-sm font-semibold text-navy-900 mb-2">

                    {wifiProfile === 'PRIMARY'
                      ? 'Primary Wi-Fi'
                      : 'Secondary Wi-Fi'}

                  </h3>

                  <label className="block text-xs font-medium text-navy-700 mb-1">

                    SSID

                  </label>

                  <input
                    type="text"
                    name={
                      wifiProfile === 'PRIMARY'
                        ? 'primarySsid'
                        : 'secondarySsid'
                    }
                    value={
                      wifiProfile === 'PRIMARY'
                        ? wifiForm.primarySsid
                        : wifiForm.secondarySsid
                    }
                    onChange={handleWifiChange}
                    autoComplete="off"
                    className="w-full rounded-lg border border-navy-200 px-3 py-1.5 text-sm outline-none focus:border-navy-400"
                    placeholder={
                      wifiProfile === 'PRIMARY'
                        ? 'Primary Wi-Fi network'
                        : 'Secondary Wi-Fi network'
                    }
                  />

                  <label className="block text-xs font-medium text-navy-700 mb-1 mt-4">

                    Password

                  </label>

                  <input
                    type="password"
                    name={
                      wifiProfile === 'PRIMARY'
                        ? 'primaryPassword'
                        : 'secondaryPassword'
                    }
                    value={
                      wifiProfile === 'PRIMARY'
                        ? wifiForm.primaryPassword
                        : wifiForm.secondaryPassword
                    }
                    onChange={handleWifiChange}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-navy-200 px-3 py-1.5 text-sm outline-none focus:border-navy-400"
                    placeholder={
                      wifiProfile === 'PRIMARY'
                        ? 'Enter primary password'
                        : 'Enter secondary password'
                    }
                  />

                </div>

                {wifiProfile === 'SECONDARY' && (
                  <p className="text-xs text-navy-500 mt-3">

                    The secondary network can be configured independently.
                    The device will retain the existing primary network.

                  </p>
                )}

                <div className="flex items-center justify-end gap-3 mt-3">

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