import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, X, RefreshCw } from 'lucide-react';

import { PageHeader, DataTable } from '@/components/ui/PageComponents';
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

  // --------------------------------------------------
  // Load leave requests
  // --------------------------------------------------
  const loadLeaves = async () => {
    try {
      setLoading(true);

      const response = await leaveService.requests();

      /*
       * Backend response:
       *
       * {
       *   success: true,
       *   message: "...",
       *   data: [...]
       * }
       *
       * Depending on apiServices.js, response may already
       * be the data array or may still contain { data: [] }.
       */

      let records = [];

      if (Array.isArray(response)) {
        records = response;
      } else if (Array.isArray(response?.data)) {
        records = response.data;
      }

      setLeaves(records);
    } catch (error) {
      console.error('Failed to load leave requests:', error);

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

    if (Number.isNaN(parsedDate.getTime())) {
      return '-';
    }

    return parsedDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // --------------------------------------------------
  // Employee name
  // --------------------------------------------------
  const getEmployeeName = (leave) => {
    const firstName = leave?.employee?.firstName || '';
    const lastName = leave?.employee?.lastName || '';

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || 'Unknown Employee';
  };

  // --------------------------------------------------
  // Approve leave
  // --------------------------------------------------
  const handleApprove = async (id) => {
    if (!id) return;

    try {
      setActionLoading(`approve-${id}`);

      await leaveService.approve(id);

      /*
       * Update the UI only after the API succeeds.
       */
      setLeaves((prev) =>
        prev.map((leave) =>
          leave.leaveRequestId === id
            ? {
                ...leave,
                status: 'APPROVED',
              }
            : leave
        )
      );

      toast('Leave request approved successfully', 'success');
    } catch (error) {
      console.error('Approve leave error:', error);

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
  // Reject leave
  // --------------------------------------------------
  const handleReject = async (id) => {
    if (!id) return;

    try {
      setActionLoading(`reject-${id}`);

      await leaveService.reject(id);

      /*
       * Update the UI only after the API succeeds.
       */
      setLeaves((prev) =>
        prev.map((leave) =>
          leave.leaveRequestId === id
            ? {
                ...leave,
                status: 'REJECTED',
              }
            : leave
        )
      );

      toast('Leave request rejected successfully', 'warning');
    } catch (error) {
      console.error('Reject leave error:', error);

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
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return leaves;
    }

    return leaves.filter((leave) => {
      const employeeName = getEmployeeName(leave).toLowerCase();

      const employeeId = String(
        leave?.employeeId ?? ''
      ).toLowerCase();

      const leaveType = String(
        leave?.leaveType?.name ?? ''
      ).toLowerCase();

      const leaveCode = String(
        leave?.leaveType?.code ?? ''
      ).toLowerCase();

      const reason = String(
        leave?.reason ?? ''
      ).toLowerCase();

      const status = String(
        leave?.status ?? ''
      ).toLowerCase();

      return (
        employeeName.includes(searchTerm) ||
        employeeId.includes(searchTerm) ||
        leaveType.includes(searchTerm) ||
        leaveCode.includes(searchTerm) ||
        reason.includes(searchTerm) ||
        status.includes(searchTerm)
      );
    });
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
            {row.leaveType?.name || '-'}
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
          {formatDate(row.startDate)}
        </span>
      ),
    },

    {
      key: 'endDate',
      label: 'End',
      render: (row) => (
        <span className="text-navy-600">
          {formatDate(row.endDate)}
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
        <StatusBadge status={row.status} />
      ),
    },

    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => {
        const isPending = row.status === 'PENDING';

        const approving =
          actionLoading === `approve-${row.leaveRequestId}`;

        const rejecting =
          actionLoading === `reject-${row.leaveRequestId}`;

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
                handleApprove(row.leaveRequestId)
              }
              disabled={approving || rejecting}
              className="p-2 rounded-lg bg-success-100 text-success-700 hover:bg-success-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Approve"
            >
              {approving ? (
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Check size={16} />
              )}
            </button>

            {/* Reject */}
            <button
              type="button"
              onClick={() =>
                handleReject(row.leaveRequestId)
              }
              disabled={approving || rejecting}
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
          filtered.length !== 1 ? 's' : ''
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
    </div>
  );
}