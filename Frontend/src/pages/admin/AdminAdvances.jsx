import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
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
import { advanceService } from '@/services/apiServices';

export function AdminAdvances() {
  const { toast } = useToast();

  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');

  // --------------------------------------------------
  // Load salary advances
  // --------------------------------------------------

  const loadAdvances = async () => {
    try {
      setLoading(true);

      const response = await advanceService.list();

      /*
       * Backend response:
       *
       * {
       *   success: true,
       *   message: "...",
       *   data: [...]
       * }
       */

      let records = [];

      if (Array.isArray(response)) {
        records = response;
      } else if (Array.isArray(response?.data)) {
        records = response.data;
      }

      setAdvances(records);
    } catch (error) {
      console.error(
        'Failed to load salary advances:',
        error
      );

      setAdvances([]);

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load salary advances',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvances();
  }, []);

  // --------------------------------------------------
  // Format currency
  // --------------------------------------------------

  const formatCurrency = (amount) => {
    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount)) {
      return '₹0';
    }

    return `₹${numericAmount.toLocaleString('en-IN')}`;
  };

  // --------------------------------------------------
  // Format date
  // --------------------------------------------------

  const formatDate = (date) => {
    if (!date) {
      return '-';
    }

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

  const getEmployeeName = (advance) => {
    const firstName =
      advance?.employee?.firstName || '';

    const lastName =
      advance?.employee?.lastName || '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return fullName || 'Unknown Employee';
  };

  // --------------------------------------------------
  // Approve advance
  // --------------------------------------------------

  const handleApprove = async (id) => {
    if (!id) return;

    try {
      setActionLoading(`approve-${id}`);

      await advanceService.approve(id);

      /*
       * Update UI only after API succeeds.
       */

      setAdvances((prev) =>
        prev.map((advance) =>
          advance.advanceId === id
            ? {
                ...advance,
                status: 'APPROVED',
              }
            : advance
        )
      );

      toast(
        'Salary advance approved successfully',
        'success'
      );
    } catch (error) {
      console.error(
        'Approve advance error:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to approve salary advance',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  // --------------------------------------------------
  // Reject advance
  // --------------------------------------------------

  const handleReject = async (id) => {
    if (!id) return;

    try {
      setActionLoading(`reject-${id}`);

      await advanceService.reject(id);

      /*
       * Update UI only after API succeeds.
       */

      setAdvances((prev) =>
        prev.map((advance) =>
          advance.advanceId === id
            ? {
                ...advance,
                status: 'REJECTED',
              }
            : advance
        )
      );

      toast(
        'Salary advance rejected successfully',
        'warning'
      );
    } catch (error) {
      console.error(
        'Reject advance error:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to reject salary advance',
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
      return advances;
    }

    return advances.filter((advance) => {
      const employeeName =
        getEmployeeName(advance).toLowerCase();

      const employeeId =
        String(
          advance?.employeeId ?? ''
        ).toLowerCase();

      const amount =
        String(
          advance?.amount ?? ''
        ).toLowerCase();

      const reason =
        String(
          advance?.reason ?? ''
        ).toLowerCase();

      const status =
        String(
          advance?.status ?? ''
        ).toLowerCase();

      return (
        employeeName.includes(searchTerm) ||
        employeeId.includes(searchTerm) ||
        amount.includes(searchTerm) ||
        reason.includes(searchTerm) ||
        status.includes(searchTerm)
      );
    });
  }, [advances, search]);

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
      key: 'amount',
      label: 'Amount',
      align: 'right',

      render: (row) => (
        <span className="font-bold text-navy-900">
          {formatCurrency(row.amount)}
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
      key: 'paymentDate',
      label: 'Requested',

      render: (row) => (
        <span className="text-navy-500 text-sm">
          {formatDate(row.paymentDate || row.createdAt)}
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
        const isPending =
          String(row.status).toUpperCase() ===
          'PENDING';

        const approving =
          actionLoading ===
          `approve-${row.advanceId}`;

        const rejecting =
          actionLoading ===
          `reject-${row.advanceId}`;

        /*
         * Approved / rejected / cancelled
         * requests don't need action buttons.
         */

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
                handleApprove(row.advanceId)
              }
              disabled={
                approving || rejecting
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
                <Check size={16} />
              )}
            </button>

            {/* Reject */}
            <button
              type="button"
              onClick={() =>
                handleReject(row.advanceId)
              }
              disabled={
                approving || rejecting
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
        message="Loading salary advances..."
      />
    );
  }

  // --------------------------------------------------
  // Page
  // --------------------------------------------------

  return (
    <div>

      <PageHeader
        title="Salary Advances"
        subtitle={`${filtered.length} request${
          filtered.length !== 1
            ? 's'
            : ''
        }`}
      />

      {/* Search + Refresh */}
      <div className="mb-5 flex items-center gap-3">

        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name or ID..."
          />
        </div>

        <button
          type="button"
          onClick={loadAdvances}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
          title="Refresh salary advances"
        >
          <RefreshCw size={16} />
          Refresh
        </button>

      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No salary advances"
          message={
            search
              ? 'No salary advances match your search.'
              : 'There are no salary advance requests to review.'
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