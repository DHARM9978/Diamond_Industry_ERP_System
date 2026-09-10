import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  X,
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
import { useToast } from '@/context/ToastContext';
import { leaveService } from '@/services/apiServices';


export function AdminLeaves() {
  const { toast } = useToast();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');

  /**
   * --------------------------------------------------
   * Approval modal state
   * --------------------------------------------------
   */
  const [approveModalOpen, setApproveModalOpen] =
    useState(false);

  const [selectedLeave, setSelectedLeave] =
    useState(null);

  const [approvedStartDate, setApprovedStartDate] =
    useState('');

  const [approvedEndDate, setApprovedEndDate] =
    useState('');

  /**
   * --------------------------------------------------
   * Reject modal state
   * --------------------------------------------------
   */
  const [rejectModalOpen, setRejectModalOpen] =
    useState(false);

  const [rejectionReason, setRejectionReason] =
    useState('');


  // --------------------------------------------------
  // Load leave requests
  // --------------------------------------------------
  const loadLeaves = async () => {
    try {
      setLoading(true);

      const response =
        await leaveService.requests();

      /*
       * Backend response may be:
       *
       * [
       *   ...
       * ]
       *
       * OR:
       *
       * {
       *   success: true,
       *   data: [...]
       * }
       */

      let records = [];

      if (Array.isArray(response)) {
        records = response;
      } else if (
        Array.isArray(response?.data)
      ) {
        records = response.data;
      }

      setLeaves(records);
    } catch (error) {
      console.error(
        'Failed to load leave requests:',
        error
      );

      setLeaves([]);

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load leave requests',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadLeaves();
  }, []);


  // --------------------------------------------------
  // Format date
  // --------------------------------------------------
  const formatDate = (date) => {
    if (!date) return '-';

    const parsedDate = new Date(date);

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


  // --------------------------------------------------
  // Convert date to YYYY-MM-DD for input
  // --------------------------------------------------
  const formatInputDate = (date) => {
    if (!date) return '';

    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return '';
    }

    const year =
      parsedDate.getFullYear();

    const month =
      String(
        parsedDate.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        parsedDate.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };


  // --------------------------------------------------
  // Employee name
  // --------------------------------------------------
  const getEmployeeName = (leave) => {
    const firstName =
      leave?.employee?.firstName || '';

    const lastName =
      leave?.employee?.lastName || '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return (
      fullName ||
      'Unknown Employee'
    );
  };


  // --------------------------------------------------
  // Open approve modal
  // --------------------------------------------------
  const openApproveModal = (leave) => {
    if (!leave?.leaveRequestId) {
      return;
    }

    setSelectedLeave(leave);

    /**
     * By default, approve the complete
     * originally requested range.
     */
    setApprovedStartDate(
      formatInputDate(
        leave.startDate
      )
    );

    setApprovedEndDate(
      formatInputDate(
        leave.endDate
      )
    );

    setApproveModalOpen(true);
  };


  // --------------------------------------------------
  // Close approve modal
  // --------------------------------------------------
  const closeApproveModal = () => {
    if (
      actionLoading !== null
    ) {
      return;
    }

    setApproveModalOpen(false);

    setSelectedLeave(null);

    setApprovedStartDate('');

    setApprovedEndDate('');
  };


  // --------------------------------------------------
  // Approve leave
  // --------------------------------------------------
  const handleApprove = async () => {
    const id =
      selectedLeave?.leaveRequestId;

    if (!id) {
      return;
    }


    /**
     * Approval dates are required.
     */
    if (
      !approvedStartDate ||
      !approvedEndDate
    ) {
      toast(
        'Approved start date and end date are required',
        'error'
      );

      return;
    }


    /**
     * Convert strings to Date objects.
     *
     * Using T00:00:00 avoids browser inconsistencies.
     */
    const requestedStart =
      new Date(
        `${formatInputDate(
          selectedLeave.startDate
        )}T00:00:00`
      );

    const requestedEnd =
      new Date(
        `${formatInputDate(
          selectedLeave.endDate
        )}T00:00:00`
      );

    const approvedStart =
      new Date(
        `${approvedStartDate}T00:00:00`
      );

    const approvedEnd =
      new Date(
        `${approvedEndDate}T00:00:00`
      );


    /**
     * Validate dates.
     */
    if (
      Number.isNaN(
        approvedStart.getTime()
      ) ||
      Number.isNaN(
        approvedEnd.getTime()
      )
    ) {
      toast(
        'Please select valid approval dates',
        'error'
      );

      return;
    }


    /**
     * Start cannot be after end.
     */
    if (
      approvedStart >
      approvedEnd
    ) {
      toast(
        'Approved end date cannot be before approved start date',
        'error'
      );

      return;
    }


    /**
     * Approved range must remain
     * inside requested range.
     */
    if (
      approvedStart <
        requestedStart ||
      approvedEnd >
        requestedEnd
    ) {
      toast(
        'Approved dates must be within the requested date range',
        'error'
      );

      return;
    }


    try {
      setActionLoading(
        `approve-${id}`
      );


      /**
       * Send approved date range
       * to backend.
       */
      await leaveService.approve(
        id,
        {
          approvedStartDate,
          approvedEndDate,
        }
      );


      toast(
        'Leave request approved successfully',
        'success'
      );


      /**
       * Close modal.
       */
      setApproveModalOpen(false);

      setSelectedLeave(null);

      setApprovedStartDate('');

      setApprovedEndDate('');


      /**
       * Reload records so the UI receives
       * approvedStartDate, approvedEndDate
       * and approvedDays from backend.
       */
      await loadLeaves();
    } catch (error) {
      console.error(
        'Approve leave error:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to approve leave request',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };


  // --------------------------------------------------
  // Open reject modal
  // --------------------------------------------------
  const openRejectModal = (leave) => {
    if (!leave?.leaveRequestId) {
      return;
    }

    setSelectedLeave(leave);

    setRejectionReason('');

    setRejectModalOpen(true);
  };


  // --------------------------------------------------
  // Close reject modal
  // --------------------------------------------------
  const closeRejectModal = () => {
    if (
      actionLoading !== null
    ) {
      return;
    }

    setRejectModalOpen(false);

    setSelectedLeave(null);

    setRejectionReason('');
  };


  // --------------------------------------------------
  // Reject leave
  // --------------------------------------------------
  const handleReject = async () => {
    const id =
      selectedLeave?.leaveRequestId;

    if (!id) {
      return;
    }


    try {
      setActionLoading(
        `reject-${id}`
      );


      /**
       * Send rejection reason to backend.
       *
       * Empty reason is allowed by the backend,
       * but a reason is recommended.
       */
      await leaveService.reject(
        id,
        {
          rejectionReason:
            rejectionReason.trim(),
        }
      );


      toast(
        'Leave request rejected successfully',
        'warning'
      );


      setRejectModalOpen(false);

      setSelectedLeave(null);

      setRejectionReason('');


      /**
       * Reload so the table receives
       * the latest status/rejection data.
       */
      await loadLeaves();
    } catch (error) {
      console.error(
        'Reject leave error:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to reject leave request',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };


  // --------------------------------------------------
  // Search
  // --------------------------------------------------
  const filtered = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    if (!searchTerm) {
      return leaves;
    }

    return leaves.filter(
      (leave) => {
        const employeeName =
          getEmployeeName(
            leave
          ).toLowerCase();

        const employeeId =
          String(
            leave?.employeeId ?? ''
          ).toLowerCase();

        const leaveType =
          String(
            leave?.leaveType?.name ?? ''
          ).toLowerCase();

        const leaveCode =
          String(
            leave?.leaveType?.code ?? ''
          ).toLowerCase();

        const reason =
          String(
            leave?.reason ?? ''
          ).toLowerCase();

        const status =
          String(
            leave?.status ?? ''
          ).toLowerCase();

        return (
          employeeName.includes(
            searchTerm
          ) ||
          employeeId.includes(
            searchTerm
          ) ||
          leaveType.includes(
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
          )
        );
      }
    );
  }, [leaves, search]);


  // --------------------------------------------------
  // Table columns
  // --------------------------------------------------
  const columns = [
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
            {row.leaveType?.name ||
              '-'}
          </span>

          {row.leaveType?.code && (
            <span className="ml-2 text-xs text-navy-400">
              (
              {row.leaveType.code}
              )
            </span>
          )}
        </div>
      ),
    },


    /**
     * Requested dates
     */
    {
      key: 'requestedDates',

      label: 'Requested',

      render: (row) => (
        <div className="text-sm">
          <div className="text-navy-600">
            {formatDate(
              row.startDate
            )}
          </div>

          <div className="text-xs text-navy-400">
            to{' '}
            {formatDate(
              row.endDate
            )}
          </div>

          <div className="mt-1 font-semibold text-navy-700">
            {row.totalDays ?? '-'} day
            {Number(
              row.totalDays
            ) === 1
              ? ''
              : 's'}
          </div>
        </div>
      ),
    },


    /**
     * Approved dates
     */
    {
      key: 'approvedDates',

      label: 'Approved',

      render: (row) => {
        if (
          row.status !==
          'APPROVED'
        ) {
          return (
            <span className="text-xs text-navy-300">
              —
            </span>
          );
        }

        return (
          <div className="text-sm">
            <div className="font-medium text-success-700">
              {formatDate(
                row.approvedStartDate
              )}
            </div>

            <div className="text-xs text-navy-400">
              to{' '}
              {formatDate(
                row.approvedEndDate
              )}
            </div>

            <div className="mt-1 font-semibold text-success-700">
              {row.approvedDays ?? '-'} day
              {Number(
                row.approvedDays
              ) === 1
                ? ''
                : 's'}
            </div>
          </div>
        );
      },
    },


    {
      key: 'reason',

      label: 'Reason',

      render: (row) => (
        <span
          className="text-sm text-navy-500"
          title={row.reason || ''}
        >
          {row.reason || '-'}
        </span>
      ),
    },


    {
      key: 'status',

      label: 'Status',

      align: 'center',

      render: (row) => (
        <div className="flex flex-col items-center gap-1">
          <StatusBadge
            status={row.status}
          />

          {row.status ===
            'REJECTED' &&
            row.rejectionReason && (
              <span
                className="max-w-[180px] truncate text-xs text-error-600"
                title={
                  row.rejectionReason
                }
              >
                {row.rejectionReason}
              </span>
            )}
        </div>
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
            <span className="text-navy-300 text-xs">
              —
            </span>
          );
        }


        return (
          <div className="flex items-center justify-end gap-2">

            {/* Approve */}
            <button
              type="button"
              onClick={() =>
                openApproveModal(
                  row
                )
              }
              disabled={
                approving ||
                rejecting
              }
              className="p-2 rounded-lg bg-success-100 text-success-700 hover:bg-success-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Approve"
            >
              {approving ? (
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Check
                  size={16}
                />
              )}
            </button>


            {/* Reject */}
            <button
              type="button"
              onClick={() =>
                openRejectModal(
                  row
                )
              }
              disabled={
                approving ||
                rejecting
              }
              className="p-2 rounded-lg bg-error-100 text-error-700 hover:bg-error-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reject"
            >
              {rejecting ? (
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <X size={16} />
              )}
            </button>
          </div>
        );
      },
    },
  ];


  // --------------------------------------------------
  // Loading
  // --------------------------------------------------
  if (loading) {
    return (
      <FullPageSpinner
        message="Loading leave requests..."
      />
    );
  }


  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div>
      <PageHeader
        title="Leave Requests"
        subtitle={`${filtered.length} request${
          filtered.length !== 1
            ? 's'
            : ''
        }`}
      />


      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee, leave type, ID..."
          />
        </div>


        <button
          type="button"
          onClick={loadLeaves}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} />

          Refresh
        </button>
      </div>


      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          message={
            search
              ? 'No leave requests match your search.'
              : 'There are no leave requests to review.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
        />
      )}


      {/* ==================================================
          APPROVE MODAL
          ================================================== */}
      {approveModalOpen &&
        selectedLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-navy-900">
                    Approve Leave
                  </h2>

                  <p className="mt-1 text-sm text-navy-500">
                    {getEmployeeName(
                      selectedLeave
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeApproveModal
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="rounded-lg p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>


              {/* Body */}
              <div className="space-y-5 px-6 py-5">

                {/* Requested range */}
                <div className="rounded-lg bg-navy-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                    Employee Requested
                  </div>

                  <div className="mt-2 text-sm font-medium text-navy-800">
                    {formatDate(
                      selectedLeave.startDate
                    )}
                    {' → '}
                    {formatDate(
                      selectedLeave.endDate
                    )}
                  </div>

                  <div className="mt-1 text-sm text-navy-500">
                    Requested days:{' '}
                    <span className="font-semibold text-navy-700">
                      {selectedLeave.totalDays}
                    </span>
                  </div>
                </div>


                {/* Approved start */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy-700">
                    Approved Start Date
                  </label>

                  <input
                    type="date"
                    value={
                      approvedStartDate
                    }
                    min={formatInputDate(
                      selectedLeave.startDate
                    )}
                    max={formatInputDate(
                      selectedLeave.endDate
                    )}
                    onChange={(event) =>
                      setApprovedStartDate(
                        event.target.value
                      )
                    }
                    disabled={
                      actionLoading !== null
                    }
                    className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 disabled:bg-navy-50"
                  />
                </div>


                {/* Approved end */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-navy-700">
                    Approved End Date
                  </label>

                  <input
                    type="date"
                    value={
                      approvedEndDate
                    }
                    min={formatInputDate(
                      selectedLeave.startDate
                    )}
                    max={formatInputDate(
                      selectedLeave.endDate
                    )}
                    onChange={(event) =>
                      setApprovedEndDate(
                        event.target.value
                      )
                    }
                    disabled={
                      actionLoading !== null
                    }
                    className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 disabled:bg-navy-50"
                  />
                </div>


                {/* Preview */}
                {approvedStartDate &&
                  approvedEndDate && (
                    <div className="rounded-lg border border-success-200 bg-success-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-success-600">
                        Approval Preview
                      </div>

                      <div className="mt-2 text-sm font-medium text-success-800">
                        {formatDate(
                          approvedStartDate
                        )}
                        {' → '}
                        {formatDate(
                          approvedEndDate
                        )}
                      </div>

                      <div className="mt-1 text-sm text-success-700">
                        Only this approved range
                        will be deducted from
                        the employee's leave
                        balance.
                      </div>
                    </div>
                  )}
              </div>


              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-navy-100 px-6 py-4">

                <button
                  type="button"
                  onClick={
                    closeApproveModal
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleApprove
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="flex items-center gap-2 rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ===
                  `approve-${selectedLeave.leaveRequestId}` ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Check size={16} />
                  )}

                  Approve Leave
                </button>
              </div>
            </div>
          </div>
        )}


      {/* ==================================================
          REJECT MODAL
          ================================================== */}
      {rejectModalOpen &&
        selectedLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-navy-900">
                    Reject Leave
                  </h2>

                  <p className="mt-1 text-sm text-navy-500">
                    {getEmployeeName(
                      selectedLeave
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeRejectModal
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="rounded-lg p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>


              {/* Body */}
              <div className="space-y-5 px-6 py-5">

                <div className="rounded-lg bg-error-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-error-500">
                    Leave Request
                  </div>

                  <div className="mt-2 text-sm font-medium text-navy-800">
                    {formatDate(
                      selectedLeave.startDate
                    )}
                    {' → '}
                    {formatDate(
                      selectedLeave.endDate
                    )}
                  </div>

                  <div className="mt-1 text-sm text-navy-500">
                    {selectedLeave.totalDays}{' '}
                    day
                    {Number(
                      selectedLeave.totalDays
                    ) === 1
                      ? ''
                      : 's'}
                  </div>
                </div>


                <div>
                  <label className="mb-2 block text-sm font-medium text-navy-700">
                    Rejection Reason
                    <span className="ml-1 text-navy-400 font-normal">
                      (optional)
                    </span>
                  </label>

                  <textarea
                    value={
                      rejectionReason
                    }
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    rows={4}
                    disabled={
                      actionLoading !== null
                    }
                    placeholder="Enter the reason for rejecting this leave request..."
                    className="w-full resize-none rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100 disabled:bg-navy-50"
                  />
                </div>
              </div>


              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-navy-100 px-6 py-4">

                <button
                  type="button"
                  onClick={
                    closeRejectModal
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleReject
                  }
                  disabled={
                    actionLoading !== null
                  }
                  className="flex items-center gap-2 rounded-lg bg-error-600 px-4 py-2 text-sm font-medium text-white hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ===
                  `reject-${selectedLeave.leaveRequestId}` ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <X size={16} />
                  )}

                  Reject Leave
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}