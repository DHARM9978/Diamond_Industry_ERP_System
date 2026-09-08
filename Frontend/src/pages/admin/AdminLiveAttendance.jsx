import { useEffect, useMemo, useState } from 'react';

import {
  Activity,
  Clock,
  Fingerprint,
  LogIn,
  LogOut,
  RefreshCw,
  Users,
  Wifi,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';

import { attendanceService } from '@/services/apiServices';


/* ============================================================
   HELPERS
   ============================================================ */

const formatTime = (value) => {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};


const formatDateTime = (value) => {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};


const getEmployeeName = (employee) => {
  if (!employee) {
    return 'Unknown Employee';
  }

  const name = [
    employee.firstName,
    employee.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || employee.email || 'Unknown Employee';
};


/* ============================================================
   LIVE ATTENDANCE PAGE
   ============================================================ */

export function AdminLiveAttendance() {

  const [liveData, setLiveData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  const [lastUpdated, setLastUpdated] = useState(null);


  /* ==========================================================
     LOAD LIVE ATTENDANCE
     ========================================================== */

  const loadLiveAttendance = async (
    showLoader = false
  ) => {

    try {

      if (showLoader) {
        setRefreshing(true);
      }

      setError(null);


      const response =
        await attendanceService.live();


      console.log(
        'Live Attendance API response:',
        response
      );


      /*
       * attendanceService.live()
       * already unwraps the API response.
       *
       * Expected:
       *
       * {
       *   date,
       *   serverTime,
       *   statistics,
       *   lastPunch,
       *   currentlyWorking,
       *   punches
       * }
       */


      const data =
        response?.data ??
        response;


      if (
        !data ||
        typeof data !== 'object'
      ) {

        throw new Error(
          'Live attendance data was not returned by the server'
        );

      }


      setLiveData(data);

      setLastUpdated(
        new Date()
      );


    } catch (error) {

      console.error(
        'Live attendance loading failed:',
        error
      );


      setError(
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load live attendance'
      );


    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  };


  /* ==========================================================
     INITIAL LOAD + AUTO REFRESH
     ========================================================== */

  useEffect(() => {

    loadLiveAttendance(true);


    /*
     * Poll every 3 seconds.
     *
     * This gives the admin a near real-time view
     * without requiring WebSocket infrastructure.
     */

    const interval =
      setInterval(() => {

        loadLiveAttendance(false);

      }, 3000);


    return () => {

      clearInterval(interval);

    };

  }, []);


  /* ==========================================================
     DERIVED DATA
     ========================================================== */

  const statistics =
    liveData?.statistics || {};


  const currentlyWorking =
    Array.isArray(
      liveData?.currentlyWorking
    )
      ? liveData.currentlyWorking
      : [];


  const punches =
    Array.isArray(
      liveData?.punches
    )
      ? liveData.punches
      : [];


  /*
   * The backend sends punches newest first.
   * Keep the first 20 for the activity table.
   */

  const recentPunches =
    useMemo(
      () => punches.slice(0, 20),
      [punches]
    );


  /* ==========================================================
     LOADING
     ========================================================== */

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading live attendance..."
      />
    );

  }


  /* ==========================================================
     ERROR
     ========================================================== */

  if (error && !liveData) {

    return (

      <div>

        <PageHeader
          title="Live Attendance"
          subtitle="Real-time fingerprint attendance activity"
        />


        <div className="card p-6">

          <div className="rounded-lg bg-error-50 p-5">

            <p className="font-semibold text-error-800">
              Unable to load live attendance
            </p>

            <p className="mt-1 text-sm text-error-700">
              {error}
            </p>


            <button
              type="button"
              onClick={() =>
                loadLiveAttendance(true)
              }
              className="
                mt-4
                inline-flex
                items-center
                gap-2
                rounded-lg
                bg-error-700
                px-4
                py-2
                text-sm
                font-medium
                text-white
                hover:bg-error-800
              "
            >

              <RefreshCw size={16} />

              Retry

            </button>

          </div>

        </div>

      </div>

    );

  }


  /* ==========================================================
     PAGE
     ========================================================== */

  return (

    <div className="space-y-6">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <PageHeader
        title="Live Attendance"
        subtitle={
          liveData?.date
            ? `Real-time attendance activity for ${liveData.date}`
            : 'Real-time fingerprint attendance activity'
        }
      />


      {/* ======================================================
          LIVE STATUS BAR
          ====================================================== */}

      <div
        className="
          flex
          flex-col
          gap-3
          rounded-xl
          border
          border-success-200
          bg-success-50
          p-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              bg-success-100
            "
          >

            <Wifi
              size={20}
              className="text-success-700"
            />

          </div>


          <div>

            <p className="font-semibold text-success-900">
              Live monitoring active
            </p>

            <p className="text-sm text-success-700">
              Automatically refreshing every 3 seconds
            </p>

          </div>

        </div>


        <div className="flex items-center gap-3">

          {lastUpdated && (

            <span className="text-xs text-success-700">

              Updated{' '}

              {formatTime(lastUpdated)}

            </span>

          )}


          <button
            type="button"
            onClick={() =>
              loadLiveAttendance(true)
            }
            disabled={refreshing}
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-success-300
              bg-white
              px-3
              py-2
              text-sm
              font-medium
              text-success-800
              hover:bg-success-100
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >

            <RefreshCw
              size={15}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh

          </button>

        </div>

      </div>


      {/* ======================================================
          ERROR WARNING
          ====================================================== */}

      {error && (

        <div className="rounded-lg bg-warning-50 p-4">

          <p className="text-sm font-medium text-warning-800">
            Live refresh warning: {error}
          </p>

        </div>

      )}


      {/* ======================================================
          STATISTICS
          ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        "
      >

        <StatCard
          title="Currently Working"
          value={
            statistics.currentlyWorking ?? 0
          }
          icon={Activity}
        />


        <StatCard
          title="Employees Today"
          value={
            statistics.employeesToday ?? 0
          }
          icon={Users}
        />


        <StatCard
          title="IN Punches"
          value={
            statistics.totalIn ?? 0
          }
          icon={LogIn}
        />


        <StatCard
          title="OUT Punches"
          value={
            statistics.totalOut ?? 0
          }
          icon={LogOut}
        />

      </div>


      {/* ======================================================
          CURRENTLY WORKING
          ====================================================== */}

      <div className="card overflow-hidden">

        <div
          className="
            flex
            flex-col
            gap-2
            border-b
            border-navy-100
            p-5
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div>

            <div className="flex items-center gap-2">

              <Activity
                size={19}
                className="text-success-600"
              />

              <h2 className="font-semibold text-navy-900">
                Currently Working
              </h2>

            </div>

            <p className="mt-1 text-sm text-navy-500">
              Employees whose latest fingerprint punch is IN
            </p>

          </div>


          <span
            className="
              inline-flex
              w-fit
              items-center
              rounded-full
              bg-success-100
              px-3
              py-1
              text-sm
              font-semibold
              text-success-800
            "
          >

            {currentlyWorking.length} working

          </span>

        </div>


        {currentlyWorking.length === 0 ? (

          <div className="p-8 text-center">

            <Users
              size={32}
              className="mx-auto text-navy-300"
            />

            <p className="mt-3 font-medium text-navy-700">
              No employees are currently working
            </p>

            <p className="mt-1 text-sm text-navy-500">
              Employees will appear here after an IN punch.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b border-navy-100 bg-navy-50">

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    IN Time
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Device
                  </th>

                </tr>

              </thead>


              <tbody>

                {currentlyWorking.map(
                  (item, index) => {

                    const employee =
                      item?.employee;

                    const punch =
                      item?.lastPunch;


                    return (

                      <tr
                        key={
                          employee?.employeeId ??
                          punch?.punchId ??
                          index
                        }
                        className="border-b border-navy-100 last:border-0"
                      >

                        <td className="px-5 py-4">

                          <div>

                            <p className="font-medium text-navy-900">

                              {getEmployeeName(
                                employee
                              )}

                            </p>

                            <p className="text-xs text-navy-500">

                              {employee?.email || '--'}

                            </p>

                          </div>

                        </td>


                        <td className="px-5 py-4">

                          <span
                            className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              bg-success-100
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-success-800
                            "
                          >

                            <span
                              className="
                                h-1.5
                                w-1.5
                                rounded-full
                                bg-success-600
                              "
                            />

                            IN

                          </span>

                        </td>


                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2">

                            <Clock
                              size={15}
                              className="text-navy-400"
                            />

                            <span className="text-sm text-navy-700">

                              {formatTime(
                                punch?.punchedAt
                              )}

                            </span>

                          </div>

                        </td>


                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2">

                            <Fingerprint
                              size={15}
                              className="text-navy-400"
                            />

                            <div>

                              <p className="text-sm text-navy-700">

                                {punch?.device?.deviceName ||
                                  'Unknown Device'}

                              </p>

                              <p className="text-xs text-navy-400">

                                {punch?.device?.deviceCode ||
                                  '--'}

                              </p>

                            </div>

                          </div>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* ======================================================
          RECENT FINGERPRINT ACTIVITY
          ====================================================== */}

      <div className="card overflow-hidden">

        <div
          className="
            flex
            flex-col
            gap-2
            border-b
            border-navy-100
            p-5
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div>

            <div className="flex items-center gap-2">

              <Fingerprint
                size={19}
                className="text-accent-600"
              />

              <h2 className="font-semibold text-navy-900">
                Recent Fingerprint Activity
              </h2>

            </div>

            <p className="mt-1 text-sm text-navy-500">
              Latest fingerprint punches received today
            </p>

          </div>


          <span className="text-sm text-navy-500">

            {statistics.totalPunches ?? 0} total punches

          </span>

        </div>


        {recentPunches.length === 0 ? (

          <div className="p-8 text-center">

            <Fingerprint
              size={32}
              className="mx-auto text-navy-300"
            />

            <p className="mt-3 font-medium text-navy-700">
              No fingerprint activity today
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b border-navy-100 bg-navy-50">

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Punch
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Time
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Device
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">
                    Sensor Slot
                  </th>

                </tr>

              </thead>


              <tbody>

                {recentPunches.map(
                  (punch, index) => {

                    const isIn =
                      punch?.punchType === 'IN';


                    return (

                      <tr
                        key={
                          punch?.punchId ??
                          index
                        }
                        className="border-b border-navy-100 last:border-0"
                      >

                        <td className="px-5 py-4">

                          <p className="font-medium text-navy-900">

                            {getEmployeeName(
                              punch?.employee
                            )}

                          </p>

                          <p className="text-xs text-navy-500">

                            {punch?.employee?.email ||
                              '--'}

                          </p>

                        </td>


                        <td className="px-5 py-4">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${
                                isIn
                                  ? 'bg-success-100 text-success-800'
                                  : 'bg-navy-100 text-navy-700'
                              }
                            `}
                          >

                            {isIn ? (
                              <LogIn size={13} />
                            ) : (
                              <LogOut size={13} />
                            )}

                            {punch?.punchType || '--'}

                          </span>

                        </td>


                        <td className="px-5 py-4">

                          <div>

                            <p className="text-sm text-navy-700">

                              {formatTime(
                                punch?.punchedAt
                              )}

                            </p>

                            <p className="text-xs text-navy-400">

                              {formatDateTime(
                                punch?.punchedAt
                              )}

                            </p>

                          </div>

                        </td>


                        <td className="px-5 py-4">

                          <p className="text-sm text-navy-700">

                            {punch?.device?.deviceName ||
                              'Unknown Device'}

                          </p>

                          <p className="text-xs text-navy-400">

                            {punch?.device?.deviceCode ||
                              '--'}

                          </p>

                        </td>


                        <td className="px-5 py-4">

                          <span className="text-sm text-navy-700">

                            {punch?.sensorSlot ??
                              '--'}

                          </span>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>

  );

}