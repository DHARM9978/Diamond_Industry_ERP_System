/*
 * EmployeeLeaves
 *
 * Backend remains the source of truth.
 * After create/cancel, this component reloads requests and balances.
 * Duplicate balance rows are defensively collapsed by leave type + year
 * so the employee never sees two cards for the same leave type.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  X,
  Clock3,
  CheckCircle2,
  XCircle,
  Ban,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
  StatCard,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import {
  leaveService,
  leaveBalanceService,
  leaveTypeService,
} from '@/services/apiServices';

/*
|--------------------------------------------------------------------------
| Helper functions
|--------------------------------------------------------------------------
*/

const unwrapArray = (value) => {
  let current = value;

  // Handle axios/service wrappers such as:
  // response -> data -> data -> [...]
  // response -> data -> [...]
  for (let i = 0; i < 4; i += 1) {
    if (Array.isArray(current)) {
      return current;
    }

    if (
      current &&
      typeof current === 'object' &&
      current.data !== undefined
    ) {
      current = current.data;
      continue;
    }

    break;
  }

  return Array.isArray(current) ? current : [];
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getRequestId = (request) => {
  return (
    request?.leaveRequestId ??
    request?.leave_request_id ??
    request?.requestId ??
    request?.id
  );
};

const getLeaveTypeId = (item) => {
  return (
    item?.leaveTypeId ??
    item?.leaveType?.leaveTypeId ??
    item?.leaveType?.id
  );
};

const getLeaveTypeName = (item) => {
  return (
    item?.leaveType?.name ??
    item?.leaveType?.leaveTypeName ??
    item?.leaveType?.code ??
    item?.leaveTypeName ??
    item?.leave_type ??
    item?.type ??
    'Leave'
  );
};

const getRequestStatus = (request) => {
  return String(
    request?.status ??
    request?.leaveStatus ??
    'PENDING'
  ).toUpperCase();
};

const getRequestDays = (request) => {
  return toNumber(
    request?.days ??
    request?.numberOfDays ??
    request?.totalDays ??
    request?.leaveDays,
    0
  );
};

const getRequestStartDate = (request) =>
  request?.startDate ?? request?.start_date;

const getRequestEndDate = (request) =>
  request?.endDate ?? request?.end_date;

const isBlockingLeaveStatus = (request) =>
  ['PENDING', 'APPROVED'].includes(getRequestStatus(request));

const datesOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) {
    return false;
  }

  const aStart = new Date(`${startA}T00:00:00`);
  const aEnd = new Date(`${endA}T00:00:00`);
  const bStart = new Date(`${startB}T00:00:00`);
  const bEnd = new Date(`${endB}T00:00:00`);

  if ([aStart, aEnd, bStart, bEnd].some((date) => Number.isNaN(date.getTime()))) {
    return false;
  }

  return aStart <= bEnd && aEnd >= bStart;
};

const getApiErrorMessage = (error) => {
  const responseData = error?.response?.data;

  return (
    responseData?.message ??
    responseData?.error?.message ??
    error?.message ??
    'Failed to submit leave request'
  );
};

const getBalanceTotal = (balance) => {
  return toNumber(
    balance?.allocated ??
    balance?.allocatedDays ??
    balance?.total ??
    balance?.totalDays ??
    balance?.annualQuota,
    0
  );
};

const getBalanceUsed = (balance) => {
  return toNumber(
    balance?.used ??
    balance?.usedDays ??
    balance?.consumed ??
    balance?.consumedDays,
    0
  );
};

const getBalanceRemaining = (balance) => {
  const explicitRemaining =
    balance?.remaining ??
    balance?.remainingDays ??
    balance?.available ??
    balance?.availableDays;

  if (
    explicitRemaining !== undefined &&
    explicitRemaining !== null
  ) {
    return toNumber(explicitRemaining, 0);
  }

  const total = getBalanceTotal(balance);
  const used = getBalanceUsed(balance);

  return Math.max(total - used, 0);
};

const getBalanceYear = (balance) =>
  balance?.year ??
  balance?.leaveYear ??
  balance?.financialYear ??
  new Date().getFullYear();

const getBalanceKey = (balance) => {
  const leaveTypeId = getLeaveTypeId(balance);

  if (leaveTypeId !== undefined && leaveTypeId !== null) {
    return `${leaveTypeId}-${getBalanceYear(balance)}`;
  }

  return String(
    balance?.leaveType?.name ??
      balance?.leaveTypeName ??
      balance?.type ??
      balance?.code ??
      'leave'
  ).trim().toLowerCase() + `-${getBalanceYear(balance)}`;
};

const normalizeBalances = (items) => {
  const byKey = new Map();

  items.forEach((balance) => {
    const key = getBalanceKey(balance);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...balance,
        _sourceCount: 1,
      });
      return;
    }

    /*
     * There should normally be exactly one balance row for an
     * employee + leave type + year. If duplicate rows are returned,
     * do not render duplicate cards.
     *
     * Prefer the row that contains an explicit remaining/used value
     * and has the larger amount of consumed leave. This prevents a
     * stale zero-used duplicate from hiding the actual used balance.
     */
    const existingUsed = getBalanceUsed(existing);
    const currentUsed = getBalanceUsed(balance);
    const existingRemaining = getBalanceRemaining(existing);
    const currentRemaining = getBalanceRemaining(balance);

    const preferred =
      currentUsed > existingUsed ||
      (currentUsed === existingUsed &&
        currentRemaining < existingRemaining)
        ? balance
        : existing;

    byKey.set(key, {
      ...preferred,
      _sourceCount: (existing._sourceCount || 1) + 1,
    });
  });

  return Array.from(byKey.values());
};

/*
|--------------------------------------------------------------------------
| Employee Leaves
|--------------------------------------------------------------------------
*/

export function EmployeeLeaves() {
  const { toast } = useToast();

  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Load leave data
  |--------------------------------------------------------------------------
  */

  const loadLeaveData = useCallback(async () => {
    setLoading(true);

    try {
      const [
        requestsResponse,
        balancesResponse,
        leaveTypesResponse,
      ] = await Promise.all([
        leaveService.requests(),
        leaveBalanceService.list(),
        leaveTypeService.list(),
      ]);

      const requestData = unwrapArray(requestsResponse);
      const balanceData = unwrapArray(balancesResponse);
      const typeData = unwrapArray(leaveTypesResponse);

      setLeaves(requestData);
      setBalances(normalizeBalances(balanceData));
      setLeaveTypes(typeData);
    } catch (error) {
      console.error(
        'Failed to load employee leave data:',
        error
      );

      setLeaves([]);
      setBalances([]);
      setLeaveTypes([]);

      toast(
        error?.response?.data?.message ||
          'Unable to load leave information',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  /*
  |--------------------------------------------------------------------------
  | Apply Leave
  |--------------------------------------------------------------------------
  */

  const handleApply = async (formData) => {
    setSubmitting(true);

    try {
      const payload = {
        leaveTypeId: Number(formData.leaveTypeId),
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason.trim(),
      };

      /*
       * Give the employee immediate feedback for a date conflict that is
       * already visible on this page. The backend performs the authoritative
       * check again, so this is only a UX improvement and never a substitute
       * for backend validation.
       */
      const localOverlap = leaves.find((request) =>
        isBlockingLeaveStatus(request) &&
        datesOverlap(
          payload.startDate,
          payload.endDate,
          getRequestStartDate(request),
          getRequestEndDate(request)
        )
      );

      if (localOverlap) {
        const existingStart = getRequestStartDate(localOverlap);
        const existingEnd = getRequestEndDate(localOverlap);

        toast(
          `Leave dates overlap an existing ${getRequestStatus(localOverlap).toLowerCase()} leave (${formatDate(existingStart)} - ${formatDate(existingEnd)}).`,
          'error'
        );
        return;
      }

      await leaveService.createRequest(payload);

      /*
       * The backend is the source of truth. Never manufacture a new request
       * or change the balance locally.
       */
      setModalOpen(false);

      toast(
        'Leave request submitted successfully',
        'success'
      );

      /*
       * Reload after the successful POST. If GET temporarily fails, do not
       * turn an already-successful submission into a false error message.
       */
      try {
        await loadLeaveData();
      } catch (reloadError) {
        console.error(
          'Leave was submitted, but refreshing leave data failed:',
          reloadError
        );
      }
    } catch (error) {
      console.error(
        'Failed to submit leave request:',
        error
      );

      console.error(
        'Leave request status:',
        error?.response?.status
      );

      console.error(
        'Leave request backend response:',
        error?.response?.data
      );

      toast(
        getApiErrorMessage(error),
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Cancel Leave
  |--------------------------------------------------------------------------
  */

  const handleCancel = async (id) => {
    if (!id) {
      return;
    }

    setCancellingId(id);

    try {
      await leaveService.cancel(id);

      /*
       * Reload from backend instead of changing
       * the local object manually.
       *
       * This keeps leave request status and balance
       * synchronized with the database.
       */

      await loadLeaveData();

      toast(
        'Leave request cancelled successfully',
        'warning'
      );
    } catch (error) {
      console.error(
        'Failed to cancel leave request:',
        error
      );

      toast(
        error?.response?.data?.message ||
          'Failed to cancel leave request',
        'error'
      );
    } finally {
      setCancellingId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Leave balance cards
  |--------------------------------------------------------------------------
  */

  const balanceCards = balances.map((balance) => {
    const total = getBalanceTotal(balance);
    const used = getBalanceUsed(balance);
    const remaining = getBalanceRemaining(balance);

    const leaveTypeName =
      balance?.leaveType?.name ??
      balance?.leaveTypeName ??
      balance?.type ??
      'Leave';

    return {
      ...balance,
      cardName: leaveTypeName,
      total,
      used,
      remaining,
    };
  });

  /*
  |--------------------------------------------------------------------------
  | Leave request table
  |--------------------------------------------------------------------------
  */

  const columns = [
    {
      key: 'leaveType',
      label: 'Type',
      render: (request) => (
        <span className="font-medium text-navy-800">
          {getLeaveTypeName(request)}
        </span>
      ),
    },

    {
      key: 'startDate',
      label: 'Start',
      render: (request) => (
        <span className="text-navy-600">
          {formatDate(
            request?.startDate ??
              request?.start_date
          )}
        </span>
      ),
    },

    {
      key: 'endDate',
      label: 'End',
      render: (request) => (
        <span className="text-navy-600">
          {formatDate(
            request?.endDate ??
              request?.end_date
          )}
        </span>
      ),
    },

    {
      key: 'days',
      label: 'Days',
      align: 'center',
      render: (request) => (
        <span className="font-semibold text-navy-700">
          {getRequestDays(request)}
        </span>
      ),
    },

    {
      key: 'reason',
      label: 'Reason',
      render: (request) => (
        <span
          className="text-navy-600 max-w-xs truncate block"
          title={request?.reason || ''}
        >
          {request?.reason || 'N/A'}
        </span>
      ),
    },

    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (request) => (
        <StatusBadge
          status={getRequestStatus(request)}
        />
      ),
    },

    {
      key: 'action',
      label: 'Action',
      align: 'center',
      render: (request) => {
        const status =
          getRequestStatus(request);

        const requestId =
          getRequestId(request);

        if (
          status !== 'PENDING' ||
          !requestId
        ) {
          return (
            <span className="text-navy-300">
              —
            </span>
          );
        }

        return (
          <button
            type="button"
            onClick={() =>
              handleCancel(requestId)
            }
            disabled={
              cancellingId === requestId
            }
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5
              rounded-lg
              text-xs font-semibold
              text-red-600
              bg-red-50
              hover:bg-red-100
              disabled:opacity-50
              disabled:cursor-not-allowed
              transition
            "
          >
            <X size={14} />

            {cancellingId === requestId
              ? 'Cancelling...'
              : 'Cancel'}
          </button>
        );
      },
    },
  ];

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading your leaves..."
      />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div>
      <PageHeader
        title="My Leaves"
        subtitle="Your leave requests and balances"
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="
              inline-flex items-center gap-2
              px-4 py-2.5
              rounded-lg
              bg-navy-700
              text-white
              text-sm font-semibold
              hover:bg-navy-800
              transition
            "
          >
            <Plus size={17} />
            Apply Leave
          </button>
        }
      />

      {/*
      |--------------------------------------------------------------------------
      | Leave Balance Cards
      |--------------------------------------------------------------------------
      */}

      {balanceCards.length > 0 ? (
        <div className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
          gap-4
          mb-8
        ">
          {balanceCards.map((balance) => {
            const usedPercent =
              balance.total > 0
                ? Math.min(
                    (balance.used /
                      balance.total) *
                      100,
                    100
                  )
                : 0;

            return (
              <div
                key={
                  balance.leaveBalanceId ??
                  balance.id ??
                  getBalanceKey(balance)
                }
                className="
                  bg-white
                  border border-navy-100
                  rounded-xl
                  p-5
                  shadow-sm
                "
              >
                <div className="
                  flex
                  items-start
                  justify-between
                  gap-3
                  mb-4
                ">
                  <div>
                    <p className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-navy-400
                    ">
                      {balance.cardName}
                    </p>

                    <p className="
                      mt-1
                      text-2xl
                      font-bold
                      text-navy-800
                    ">
                      {balance.remaining}
                    </p>

                    <p className="
                      text-xs
                      text-navy-400
                      mt-0.5
                    ">
                      days remaining
                    </p>
                  </div>

                  <div className="
                    w-10 h-10
                    rounded-lg
                    bg-navy-50
                    flex
                    items-center
                    justify-center
                  ">
                    <CalendarDays
                      size={20}
                      className="text-navy-600"
                    />
                  </div>
                </div>

                <div className="
                  flex
                  items-center
                  justify-between
                  text-xs
                  mb-2
                ">
                  <span className="text-navy-500">
                    Used
                  </span>

                  <span className="
                    font-semibold
                    text-navy-700
                  ">
                    {balance.used} / {balance.total}
                  </span>
                </div>

                <div className="
                  h-2
                  rounded-full
                  bg-navy-100
                  overflow-hidden
                ">
                  <div
                    className="
                      h-full
                      rounded-full
                      bg-navy-600
                      transition-all
                      duration-500
                    "
                    style={{
                      width: `${usedPercent}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="
          mb-8
          rounded-xl
          border border-dashed
          border-navy-200
          bg-navy-50/30
          p-6
          text-center
        ">
          <CalendarDays
            size={28}
            className="
              mx-auto
              mb-2
              text-navy-300
            "
          />

          <p className="
            text-sm
            font-medium
            text-navy-600
          ">
            No leave balances available
          </p>

          <p className="
            text-xs
            text-navy-400
            mt-1
          ">
            Your leave balances will appear
            here when they are assigned.
          </p>
        </div>
      )}

      {/*
      |--------------------------------------------------------------------------
      | Leave Requests
      |--------------------------------------------------------------------------
      */}

      <div className="mb-4">
        <h2 className="
          text-lg
          font-semibold
          text-navy-800
        ">
          Leave Requests
        </h2>

        <p className="
          text-sm
          text-navy-500
          mt-1
        ">
          Track your submitted leave requests
        </p>
      </div>

      {leaves.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          message="You have not submitted any leave requests yet."
        />
      ) : (
        <DataTable
          columns={columns}
          data={leaves}
        />
      )}

      {/*
      |--------------------------------------------------------------------------
      | Apply Leave Modal
      |--------------------------------------------------------------------------
      */}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!submitting) {
            setModalOpen(false);
          }
        }}
        title="Apply for Leave"
      >
        <LeaveForm
          balances={balances}
          leaveTypes={leaveTypes}
          submitting={submitting}
          onSubmit={handleApply}
          onCancel={() => {
            if (!submitting) {
              setModalOpen(false);
            }
          }}
        />
      </Modal>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Leave Form
|--------------------------------------------------------------------------
*/

function LeaveForm({
  balances,
  leaveTypes,
  submitting,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [error, setError] = useState('');

  /*
  |--------------------------------------------------------------------------
  | Calculate requested days
  |--------------------------------------------------------------------------
  */

  const calculateDays = () => {
    if (
      !form.startDate ||
      !form.endDate
    ) {
      return 0;
    }

    const start = new Date(
      `${form.startDate}T00:00:00`
    );

    const end = new Date(
      `${form.endDate}T00:00:00`
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return 0;
    }

    if (end < start) {
      return 0;
    }

    const difference =
      end.getTime() -
      start.getTime();

    return (
      Math.floor(
        difference /
          (1000 * 60 * 60 * 24)
      ) + 1
    );
  };

  const requestedDays =
    calculateDays();

  /*
  |--------------------------------------------------------------------------
  | Find selected balance
  |--------------------------------------------------------------------------
  */

  const selectedBalance =
    balances.find(
      (balance) =>
        String(
          getLeaveTypeId(balance)
        ) ===
        String(form.leaveTypeId)
    );

  const availableDays =
    selectedBalance
      ? getBalanceRemaining(
          selectedBalance
        )
      : null;

  /*
  |--------------------------------------------------------------------------
  | Change handler
  |--------------------------------------------------------------------------
  */

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError('');
  };

  /*
  |--------------------------------------------------------------------------
  | Submit
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');

    if (!form.leaveTypeId) {
      setError(
        'Please select a leave type.'
      );
      return;
    }

    if (!form.startDate) {
      setError(
        'Please select a start date.'
      );
      return;
    }

    if (!form.endDate) {
      setError(
        'Please select an end date.'
      );
      return;
    }

    if (requestedDays <= 0) {
      setError(
        'End date must be on or after the start date.'
      );
      return;
    }

    /*
     * If a balance exists for this leave type,
     * validate against the real backend balance.
     */

    if (
      availableDays !== null &&
      requestedDays > availableDays
    ) {
      setError(
        `You only have ${availableDays} day${
          availableDays === 1
            ? ''
            : 's'
        } remaining for this leave type.`
      );
      return;
    }

    if (!form.reason.trim()) {
      setError(
        'Please enter a reason for the leave.'
      );
      return;
    }

    await onSubmit(form);
  };

  /*
  |--------------------------------------------------------------------------
  | Form
  |--------------------------------------------------------------------------
  */

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/*
      |--------------------------------------------------------------------------
      | Leave Type
      |--------------------------------------------------------------------------
      */}

      <div>
        <label className="
          block
          text-sm
          font-medium
          text-navy-700
          mb-1.5
        ">
          Leave Type
        </label>

        <select
          name="leaveTypeId"
          value={form.leaveTypeId}
          onChange={handleChange}
          disabled={submitting}
          className="
            w-full
            rounded-lg
            border border-navy-200
            bg-white
            px-3
            py-2.5
            text-sm
            text-navy-800
            outline-none
            focus:border-navy-500
            focus:ring-2
            focus:ring-navy-100
          "
        >
          <option value="">
            Select leave type
          </option>

          {leaveTypes.map((type) => (
            <option
              key={
                type.leaveTypeId ??
                type.id
              }
              value={
                type.leaveTypeId ??
                type.id
              }
            >
              {type.name ??
                type.leaveTypeName ??
                type.code ??
                'Leave'}
            </option>
          ))}
        </select>

        {selectedBalance && (
          <p className="
            mt-1.5
            text-xs
            text-navy-500
          ">
            Available:{' '}
            <span className="font-semibold">
              {availableDays} day
              {availableDays === 1
                ? ''
                : 's'}
            </span>
          </p>
        )}
      </div>

      {/*
      |--------------------------------------------------------------------------
      | Dates
      |--------------------------------------------------------------------------
      */}

      <div className="
        grid
        grid-cols-1
        sm:grid-cols-2
        gap-4
      ">
        <div>
          <label className="
            block
            text-sm
            font-medium
            text-navy-700
            mb-1.5
          ">
            Start Date
          </label>

          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            disabled={submitting}
            className="
              w-full
              rounded-lg
              border border-navy-200
              bg-white
              px-3
              py-2.5
              text-sm
              text-navy-800
              outline-none
              focus:border-navy-500
              focus:ring-2
              focus:ring-navy-100
            "
          />
        </div>

        <div>
          <label className="
            block
            text-sm
            font-medium
            text-navy-700
            mb-1.5
          ">
            End Date
          </label>

          <input
            type="date"
            name="endDate"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={handleChange}
            disabled={submitting}
            className="
              w-full
              rounded-lg
              border border-navy-200
              bg-white
              px-3
              py-2.5
              text-sm
              text-navy-800
              outline-none
              focus:border-navy-500
              focus:ring-2
              focus:ring-navy-100
            "
          />
        </div>
      </div>

      {/*
      |--------------------------------------------------------------------------
      | Requested Days
      |--------------------------------------------------------------------------
      */}

      {requestedDays > 0 && (
        <div className="
          flex
          items-center
          gap-3
          rounded-lg
          bg-navy-50
          border border-navy-100
          px-4
          py-3
        ">
          <Clock3
            size={18}
            className="text-navy-600"
          />

          <div>
            <p className="
              text-xs
              text-navy-500
            ">
              Requested duration
            </p>

            <p className="
              text-sm
              font-semibold
              text-navy-800
            ">
              {requestedDays} day
              {requestedDays === 1
                ? ''
                : 's'}
            </p>
          </div>
        </div>
      )}

      {/*
      |--------------------------------------------------------------------------
      | Reason
      |--------------------------------------------------------------------------
      */}

      <div>
        <label className="
          block
          text-sm
          font-medium
          text-navy-700
          mb-1.5
        ">
          Reason
        </label>

        <textarea
          name="reason"
          value={form.reason}
          onChange={handleChange}
          disabled={submitting}
          rows={4}
          placeholder="Enter the reason for your leave..."
          className="
            w-full
            rounded-lg
            border border-navy-200
            bg-white
            px-3
            py-2.5
            text-sm
            text-navy-800
            outline-none
            resize-none
            focus:border-navy-500
            focus:ring-2
            focus:ring-navy-100
          "
        />
      </div>

      {/*
      |--------------------------------------------------------------------------
      | Error
      |--------------------------------------------------------------------------
      */}

      {error && (
        <div className="
          rounded-lg
          border border-red-200
          bg-red-50
          px-4
          py-3
          text-sm
          text-red-700
        ">
          {error}
        </div>
      )}

      {/*
      |--------------------------------------------------------------------------
      | Actions
      |--------------------------------------------------------------------------
      */}

      <div className="
        flex
        items-center
        justify-end
        gap-3
        pt-2
      ">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="
            px-4
            py-2.5
            rounded-lg
            border border-navy-200
            text-sm
            font-medium
            text-navy-600
            hover:bg-navy-50
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition
          "
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="
            px-4
            py-2.5
            rounded-lg
            bg-navy-700
            text-white
            text-sm
            font-semibold
            hover:bg-navy-800
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition
          "
        >
          {submitting
            ? 'Submitting...'
            : 'Submit Leave'}
        </button>
      </div>
    </form>
  );
} 