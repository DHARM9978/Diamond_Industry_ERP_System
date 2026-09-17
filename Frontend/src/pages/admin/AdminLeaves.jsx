import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  X,
  RefreshCw,
  Filter,
  Search,
  RotateCcw,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';
import { useToast } from '@/context/ToastContext';

import { leaveService } from '@/services/apiServices';


// ============================================================
// CONSTANTS
// ============================================================

const STATUS_OPTIONS = [
  {
    value: '',
    label: 'All Statuses',
  },
  {
    value: 'PENDING',
    label: 'Pending',
  },
  {
    value: 'APPROVED',
    label: 'Approved',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
  },
];


// ============================================================
// HELPERS
// ============================================================

const getErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};


const getEmployeeName = (leave) => {
  const firstName =
    leave?.employee?.firstName || '';

  const lastName =
    leave?.employee?.lastName || '';

  const fullName =
    `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    leave?.employee?.email ||
    'Unknown Employee'
  );
};


const formatDate = (date) => {
  if (!date) {
    return '-';
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return '-';
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


const formatDateTime = (date) => {
  if (!date) {
    return '-';
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return '-';
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


const getRequestTime = (leave) => {
  const createdAt =
    leave?.createdAt;

  if (createdAt) {
    const timestamp =
      new Date(createdAt).getTime();

    if (
      Number.isFinite(timestamp)
    ) {
      return timestamp;
    }
  }

  /*
   * Fallback for older records where
   * createdAt may not be available.
   *
   * leaveRequestId is monotonically
   * increasing in the current schema,
   * so it still gives a deterministic
   * latest-first ordering.
   */
  const requestId =
    Number(
      leave?.leaveRequestId
    );

  return Number.isFinite(requestId)
    ? requestId
    : 0;
};


const sortNewestFirst = (records) => {
  return [...records].sort(
    (a, b) => {
      const timeDifference =
        getRequestTime(b) -
        getRequestTime(a);

      if (
        timeDifference !== 0
      ) {
        return timeDifference;
      }

      /*
       * Stable secondary ordering.
       */
      return (
        Number(
          b?.leaveRequestId || 0
        ) -
        Number(
          a?.leaveRequestId || 0
        )
      );
    }
  );
};


// ============================================================
// ADMIN LEAVE REQUESTS
// ============================================================

export function AdminLeaves() {
  const { toast } = useToast();

  // ==========================================================
  // DATA
  // ==========================================================

  const [leaves, setLeaves] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(null);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('');

  const [leaveTypeFilter, setLeaveTypeFilter] =
    useState('');

  // ==========================================================
  // LOAD LEAVE REQUESTS
  // ==========================================================

  const loadLeaves = async (
    showRefresh = false
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      /*
       * The backend already supports:
       *
       * GET /api/leave-requests?status=PENDING
       *
       * The current leave request service also
       * orders requests by createdAt DESC.
       *
       * We still sort the returned data on the
       * frontend as a defensive guarantee so the
       * newest request remains first after local
       * approve/reject updates.
       */
      const params = {};

      if (statusFilter) {
        params.status =
          statusFilter;
      }

      const response =
        await leaveService.requests(
          params
        );

      let records = [];

      if (
        Array.isArray(response)
      ) {
        records = response;
      } else if (
        Array.isArray(
          response?.data
        )
      ) {
        records =
          response.data;
      }

      setLeaves(
        sortNewestFirst(records)
      );
    } catch (error) {
      console.error(
        'Failed to load leave requests:',
        error
      );

      setLeaves([]);

      toast(
        getErrorMessage(
          error,
          'Failed to load leave requests'
        ),
        'error'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  // ==========================================================
  // INITIAL LOAD + STATUS REFRESH
  // ==========================================================

  useEffect(() => {
    loadLeaves();
  }, [statusFilter]);


  // ==========================================================
  // DERIVED LEAVE TYPES
  // ==========================================================

  const leaveTypeOptions =
    useMemo(() => {
      const map =
        new Map();

      leaves.forEach(
        (leave) => {
          const id =
            leave?.leaveType
              ?.leaveTypeId ??
            leave?.leaveTypeId;

          const name =
            leave?.leaveType?.name ||
            leave?.leaveType?.leaveTypeName ||
            (id
              ? `Leave Type ${id}`
              : '');

          if (
            id !== undefined &&
            id !== null &&
            name
          ) {
            map.set(
              String(id),
              name
            );
          }
        }
      );

      return Array.from(
        map.entries()
      )
        .map(
          ([value, label]) => ({
            value,
            label,
          })
        )
        .sort(
          (a, b) =>
            a.label.localeCompare(
              b.label
            )
        );
    }, [leaves]);


  // ==========================================================
  // SEARCH + LEAVE TYPE FILTER
  // ==========================================================

  const filtered = useMemo(() => {
    const searchTerm =
      search
        .trim()
        .toLowerCase();

    const result =
      leaves.filter(
        (leave) => {
          // ---------------------------------------------------
          // Status
          // ---------------------------------------------------

          if (
            statusFilter &&
            String(
              leave?.status ?? ''
            ).toUpperCase() !==
              statusFilter
          ) {
            return false;
          }

          // ---------------------------------------------------
          // Leave type
          // ---------------------------------------------------

          if (
            leaveTypeFilter
          ) {
            const rowLeaveTypeId =
              leave?.leaveType
                ?.leaveTypeId ??
              leave?.leaveTypeId;

            if (
              String(
                rowLeaveTypeId ?? ''
              ) !==
              String(
                leaveTypeFilter
              )
            ) {
              return false;
            }
          }

          // ---------------------------------------------------
          // Search
          // ---------------------------------------------------

          if (!searchTerm) {
            return true;
          }

          const employeeName =
            getEmployeeName(
              leave
            ).toLowerCase();

          const employeeId =
            String(
              leave?.employeeId ??
              ''
            ).toLowerCase();

          const employeeEmail =
            String(
              leave?.employee?.email ??
              ''
            ).toLowerCase();

          const leaveTypeName =
            String(
              leave?.leaveType?.name ??
              leave?.leaveType?.leaveTypeName ??
              ''
            ).toLowerCase();

          const leaveCode =
            String(
              leave?.leaveType?.code ??
              ''
            ).toLowerCase();

          const reason =
            String(
              leave?.reason ??
              ''
            ).toLowerCase();

          const status =
            String(
              leave?.status ??
              ''
            ).toLowerCase();

          const requestId =
            String(
              leave?.leaveRequestId ??
              ''
            ).toLowerCase();

          return (
            employeeName.includes(
              searchTerm
            ) ||
            employeeId.includes(
              searchTerm
            ) ||
            employeeEmail.includes(
              searchTerm
            ) ||
            leaveTypeName.includes(
              searchTerm
            ) ||
            leaveCode.includes(
              searchTerm
            ) ||
            reason.includes(
              searchTerm
            ) ||
            status.includes(
              searchTerm
            ) ||
            requestId.includes(
              searchTerm
            )
          );
        }
      );

    return sortNewestFirst(
      result
    );
  }, [
    leaves,
    search,
    statusFilter,
    leaveTypeFilter,
  ]);


  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setLeaveTypeFilter('');
  };


  const hasActiveFilters =
    Boolean(
      search.trim()
    ) ||
    Boolean(
      statusFilter
    ) ||
    Boolean(
      leaveTypeFilter
    );


  // ==========================================================
  // APPROVE
  // ==========================================================

  const handleApprove =
    async (id) => {
      if (!id) {
        return;
      }

      try {
        setActionLoading(
          `approve-${id}`
        );

        const response =
          await leaveService.approve(
            id
          );

        /*
         * Update the UI only after the
         * API successfully approves the
         * request.
         */
        setLeaves(
          (previous) =>
            sortNewestFirst(
              previous.map(
                (leave) =>
                  leave.leaveRequestId === id
                    ? {
                        ...leave,
                        status:
                          'APPROVED',
                        approvedAt:
                          response?.approvedAt ??
                          leave.approvedAt ??
                          new Date().toISOString(),
                      }
                    : leave
              )
            )
        );

        toast(
          'Leave request approved successfully',
          'success'
        );
      } catch (error) {
        console.error(
          'Approve leave error:',
          error
        );

        toast(
          getErrorMessage(
            error,
            'Failed to approve leave request'
          ),
          'error'
        );
      } finally {
        setActionLoading(
          null
        );
      }
    };


  // ==========================================================
  // REJECT
  // ==========================================================

  const handleReject =
    async (id) => {
      if (!id) {
        return;
      }

      try {
        setActionLoading(
          `reject-${id}`
        );

        const response =
          await leaveService.reject(
            id
          );

        /*
         * Update the UI only after the
         * API successfully rejects the
         * request.
         */
        setLeaves(
          (previous) =>
            sortNewestFirst(
              previous.map(
                (leave) =>
                  leave.leaveRequestId === id
                    ? {
                        ...leave,
                        status:
                          'REJECTED',
                        rejectedAt:
                          response?.rejectedAt ??
                          leave.rejectedAt ??
                          new Date().toISOString(),
                      }
                    : leave
              )
            )
        );

        toast(
          'Leave request rejected successfully',
          'warning'
        );
      } catch (error) {
        console.error(
          'Reject leave error:',
          error
        );

        toast(
          getErrorMessage(
            error,
            'Failed to reject leave request'
          ),
          'error'
        );
      } finally {
        setActionLoading(
          null
        );
      }
    };


  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

  const columns = [
    {
      key: 'leaveRequestId',
      label: 'Request ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-600">
          #{row.leaveRequestId}
        </span>
      ),
    },

    {
      key: 'employeeId',
      label: 'Emp ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-600">
          {row.employeeId}
        </span>
      ),
    },

    {
      key: 'employee',
      label: 'Employee',
      render: (row) => (
        <div>
          <div className="font-medium text-navy-900">
            {getEmployeeName(row)}
          </div>

          {row.employee?.email && (
            <div className="text-xs text-navy-400">
              {row.employee.email}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'leaveType',
      label: 'Type',
      render: (row) => (
        <div>
          <span className="text-navy-700">
            {
              row.leaveType?.name ||
              row.leaveType?.leaveTypeName ||
              '-'
            }
          </span>

          {row.leaveType?.code && (
            <span className="ml-2 text-xs text-navy-400">
              ({row.leaveType.code})
            </span>
          )}
        </div>
      ),
    },

    {
      key: 'startDate',
      label: 'Start',
      render: (row) => (
        <span className="text-navy-600">
          {formatDate(
            row.startDate
          )}
        </span>
      ),
    },

    {
      key: 'endDate',
      label: 'End',
      render: (row) => (
        <span className="text-navy-600">
          {formatDate(
            row.endDate
          )}
        </span>
      ),
    },

    {
      key: 'totalDays',
      label: 'Days',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-navy-700">
          {row.totalDays}
        </span>
      ),
    },

    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span
          className="block max-w-xs truncate text-sm text-navy-500"
          title={
            row.reason || ''
          }
        >
          {row.reason || '-'}
        </span>
      ),
    },

    {
      key: 'createdAt',
      label: 'Requested On',
      render: (row) => (
        <span
          className="whitespace-nowrap text-sm text-navy-600"
          title={
            row.createdAt
              ? formatDateTime(
                  row.createdAt
                )
              : ''
          }
        >
          {formatDate(
            row.createdAt
          )}
        </span>
      ),
    },

    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => (
        <StatusBadge
          status={row.status}
        />
      ),
    },

    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => {
        const isPending =
          row.status ===
          'PENDING';

        const approving =
          actionLoading ===
          `approve-${row.leaveRequestId}`;

        const rejecting =
          actionLoading ===
          `reject-${row.leaveRequestId}`;

        if (!isPending) {
          return (
            <span className="text-xs text-navy-300">
              —
            </span>
          );
        }

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                handleApprove(
                  row.leaveRequestId
                )
              }
              disabled={
                Boolean(
                  actionLoading
                )
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                bg-success-100
                px-3
                py-2
                text-xs
                font-semibold
                text-success-700
                transition-colors
                hover:bg-success-200
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
              title="Approve"
            >
              {approving ? (
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Check
                  size={14}
                />
              )}

              Approve
            </button>

            <button
              type="button"
              onClick={() =>
                handleReject(
                  row.leaveRequestId
                )
              }
              disabled={
                Boolean(
                  actionLoading
                )
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                bg-error-100
                px-3
                py-2
                text-xs
                font-semibold
                text-error-700
                transition-colors
                hover:bg-error-200
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
              title="Reject"
            >
              {rejecting ? (
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <X
                  size={14}
                />
              )}

              Reject
            </button>
          </div>
        );
      },
    },
  ];


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading leave requests..."
      />
    );
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="space-y-5">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <PageHeader
        title="Leave Requests"
        subtitle={`${filtered.length} ${
          filtered.length === 1
            ? 'request'
            : 'requests'
        }`}
      />


      {/* ======================================================
          FILTER BAR
      ====================================================== */}

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col">

          {/* Filter header */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 pb-4">

            <div className="flex items-center gap-2">
              <Filter
                size={18}
                className="text-navy-500"
              />

              <h2 className="text-sm font-semibold text-navy-800">
                Filters
              </h2>

              {hasActiveFilters && (
                <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-700">
                  Active
                </span>
              )}
            </div>

            <div className="text-xs text-navy-400">
              Click a status to filter instantly
            </div>
          </div>


          {/* Main filter controls */}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">

            {/* Search */}

            <div className="lg:col-span-6">
              <label
                htmlFor="leave-search"
                className="mb-1.5 block text-xs font-medium text-navy-500"
              >
                Search
              </label>

              <SearchInput
                id="leave-search"
                value={search}
                onChange={setSearch}
                placeholder="Search employee, ID, type, reason..."
              />
            </div>


            {/* Leave Type */}

            <div className="lg:col-span-3">
              <label
                htmlFor="leave-type-filter"
                className="mb-1.5 block text-xs font-medium text-navy-500"
              >
                Leave Type
              </label>

              <select
                id="leave-type-filter"
                value={leaveTypeFilter}
                onChange={(event) =>
                  setLeaveTypeFilter(
                    event.target.value
                  )
                }
                className="
                  h-10
                  w-full
                  rounded-lg
                  border
                  border-navy-200
                  bg-white
                  px-3
                  py-2.5
                  text-sm
                  text-navy-800
                  outline-none
                  transition
                  focus:border-accent-400
                  focus:ring-2
                  focus:ring-accent-100
                "
              >
                <option value="">
                  All Leave Types
                </option>

                {leaveTypeOptions.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>
            </div>


            {/* Actions */}

            <div className="flex gap-2 lg:col-span-3">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="
                  inline-flex
                  h-10
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border
                  border-navy-200
                  bg-white
                  px-3
                  text-sm
                  font-medium
                  text-navy-700
                  transition-colors
                  hover:bg-navy-50
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <RotateCcw size={15} />
                Clear
              </button>

              <button
                type="button"
                onClick={() =>
                  loadLeaves(true)
                }
                disabled={refreshing}
                className="
                  inline-flex
                  h-10
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border
                  border-navy-200
                  bg-white
                  px-3
                  text-sm
                  font-medium
                  text-navy-700
                  transition-colors
                  hover:bg-navy-50
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
                title="Refresh leave requests"
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


          {/* Quick status filters */}

          <div className="mt-4 border-t border-navy-100 pt-4">

            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-navy-500">
                Status
              </label>

              <span className="text-xs text-navy-400">
                {statusFilter
                  ? `${statusFilter.charAt(0)}${statusFilter.slice(1).toLowerCase()} requests`
                  : 'All requests'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(
                (option) => {
                  const isSelected =
                    statusFilter ===
                    option.value;

                  const label =
                    option.value === ''
                      ? 'All'
                      : option.label;

                  return (
                    <button
                      key={
                        option.value ||
                        'ALL'
                      }
                      type="button"
                      onClick={() => {
                        setStatusFilter(
                          option.value
                        );
                        setLeaveTypeFilter(
                          ''
                        );
                      }}
                      className={`
                        inline-flex
                        h-9
                        min-w-[92px]
                        items-center
                        justify-center
                        rounded-lg
                        border
                        px-4
                        text-sm
                        font-semibold
                        transition-all
                        focus:outline-none
                        focus:ring-2
                        focus:ring-accent-200
                        ${
                          isSelected
                            ? 'border-accent-600 bg-accent-600 text-white shadow-sm'
                            : 'border-navy-200 bg-white text-navy-700 hover:border-navy-300 hover:bg-navy-50'
                        }
                      `}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>
          </div>


          {/* Result summary */}

          <div className="mt-4 flex flex-col gap-2 border-t border-navy-100 pt-4 text-xs text-navy-500 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Search size={14} />

              <span>
                Showing{' '}
                <strong className="text-navy-700">
                  {filtered.length}
                </strong>{' '}
                of{' '}
                <strong className="text-navy-700">
                  {leaves.length}
                </strong>{' '}
                loaded requests
              </span>
            </div>

            <span className="text-navy-400">
              Newest requests appear first
            </span>
          </div>

        </div>
      </div>


      {/* ======================================================
          TABLE / EMPTY STATE
      ====================================================== */}

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={
              CalendarDays
            }
            title="No leave requests"
            message={
              hasActiveFilters
                ? 'No leave requests match the selected filters.'
                : 'There are no leave requests to review.'
            }
          />
        </div>
      ) : (
        <DataTable
          columns={
            columns
          }
          data={
            filtered
          }
        />
      )}

    </div>
  );
}
