import { useEffect, useMemo, useState } from 'react';

import {
  Banknote,
  Check,
  X,
  RefreshCw,
  CreditCard,
  Pencil,
  Lock,
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


// ============================================================
// ADMIN ADVANCES
// ============================================================

export function AdminAdvances() {
  const { toast } = useToast();

  const [advances, setAdvances] = useState([]);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] =
    useState(null);

  const [search, setSearch] = useState('');

  // ----------------------------------------------------------
  // Modal state
  // ----------------------------------------------------------

  const [modalType, setModalType] =
    useState(null);
  // null
  // "approve"
  // "edit-approval"
  // "pay"

  const [selectedAdvance, setSelectedAdvance] =
    useState(null);

  const [amountInput, setAmountInput] =
    useState('');

  // ==========================================================
  // Load salary advances
  // ==========================================================

  const loadAdvances = async () => {
    try {
      setLoading(true);

      const response =
        await advanceService.list();

      let records = [];

      if (Array.isArray(response)) {
        records = response;
      } else if (
        Array.isArray(response?.data)
      ) {
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


  // ==========================================================
  // Initial load
  // ==========================================================

  useEffect(() => {
    loadAdvances();
  }, []);


  // ==========================================================
  // Format currency
  // ==========================================================

  const formatCurrency = (amount) => {
    if (
      amount === undefined ||
      amount === null ||
      amount === ''
    ) {
      return '-';
    }

    const numericAmount =
      Number(amount);

    if (
      Number.isNaN(numericAmount)
    ) {
      return '-';
    }

    return `₹${numericAmount.toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };


  // ==========================================================
  // Format date
  // ==========================================================

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


  // ==========================================================
  // Employee name
  // ==========================================================

  const getEmployeeName = (
    advance
  ) => {
    const firstName =
      advance?.employee?.firstName ||
      '';

    const lastName =
      advance?.employee?.lastName ||
      '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return (
      fullName ||
      'Unknown Employee'
    );
  };


  // ==========================================================
  // Normalize status
  // ==========================================================

  const getStatus = (
    advance
  ) => {
    return String(
      advance?.status || ''
    )
      .trim()
      .toUpperCase();
  };


  // ==========================================================
  // Close modal
  // ==========================================================

  const closeModal = () => {
    setModalType(null);
    setSelectedAdvance(null);
    setAmountInput('');
  };


  // ==========================================================
  // Open approve modal
  // ==========================================================

  const openApproveModal = (
    advance
  ) => {
    if (!advance) {
      return;
    }

    if (
      getStatus(advance) !==
      'PENDING'
    ) {
      return;
    }

    setSelectedAdvance(
      advance
    );

    setAmountInput(
      String(
        advance?.approvedAmount ??
          advance?.amount ??
          ''
      )
    );

    setModalType('approve');
  };


  // ==========================================================
  // Open edit approval modal
  // ==========================================================

  const openEditApprovalModal = (
    advance
  ) => {
    if (!advance) {
      return;
    }

    if (
      getStatus(advance) !==
      'APPROVED'
    ) {
      return;
    }

    setSelectedAdvance(
      advance
    );

    setAmountInput(
      String(
        advance?.approvedAmount ??
          advance?.amount ??
          ''
      )
    );

    setModalType(
      'edit-approval'
    );
  };


  // ==========================================================
  // Open payment modal
  // ==========================================================

  const openPayModal = (
    advance
  ) => {
    if (!advance) {
      return;
    }

    if (
      getStatus(advance) !==
      'APPROVED'
    ) {
      return;
    }

    setSelectedAdvance(
      advance
    );

    setAmountInput('');

    setModalType('pay');
  };


  // ==========================================================
  // Approve / update approved amount
  // ==========================================================

  const handleApproveSubmit =
    async () => {

      if (!selectedAdvance) {
        return;
      }

      const id =
        selectedAdvance.advanceId;

      const requestedAmount =
        Number(
          selectedAdvance.amount
        );

      const approvedAmount =
        Number(amountInput);

      if (
        !Number.isFinite(
          approvedAmount
        ) ||
        approvedAmount <= 0
      ) {
        toast(
          'Approved amount must be greater than 0',
          'error'
        );

        return;
      }

      if (
        approvedAmount >
        requestedAmount
      ) {
        toast(
          'Approved amount cannot be greater than requested amount',
          'error'
        );

        return;
      }

      try {
        setActionLoading(
          `approve-${id}`
        );

        const response =
          await advanceService.updateStatus(
            id,
            'APPROVED',
            {
              approvedAmount,
            }
          );

        const updatedAdvance =
          response?.data ??
          response;

        setAdvances(
          (prev) =>
            prev.map(
              (advance) =>
                advance.advanceId === id
                  ? {
                      ...advance,
                      ...(updatedAdvance || {}),
                      status:
                        'APPROVED',
                      approvedAmount,
                    }
                  : advance
            )
        );

        toast(
          modalType ===
            'edit-approval'
            ? 'Approved amount updated successfully'
            : 'Salary advance approved successfully',
          'success'
        );

        closeModal();
      } catch (error) {
        console.error(
          'Approve advance error:',
          error
        );

        toast(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Failed to approve salary advance',
          'error'
        );
      } finally {
        setActionLoading(null);
      }
    };


  // ==========================================================
  // Reject advance
  // ==========================================================

  const handleReject = async (
    id
  ) => {
    if (!id) {
      return;
    }

    try {
      setActionLoading(
        `reject-${id}`
      );

      const response =
        await advanceService.updateStatus(
          id,
          'REJECTED'
        );

      const updatedAdvance =
        response?.data ??
        response;

      setAdvances(
        (prev) =>
          prev.map(
            (advance) =>
              advance.advanceId === id
                ? {
                    ...advance,
                    ...(updatedAdvance ||
                      {}),
                    status:
                      'REJECTED',
                    approvedAmount:
                      null,
                    paidAmount:
                      null,
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
        error?.response?.data
          ?.message ||
          error?.message ||
          'Failed to reject salary advance',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };


  // ==========================================================
  // Record payment
  // ==========================================================

  const handlePaySubmit =
    async () => {

      if (!selectedAdvance) {
        return;
      }

      const id =
        selectedAdvance.advanceId;

      const paidAmount =
        Number(amountInput);

      if (
        !Number.isFinite(
          paidAmount
        ) ||
        paidAmount <= 0
      ) {
        toast(
          'Paid amount must be greater than 0',
          'error'
        );

        return;
      }

      if (
        !selectedAdvance
          .approvedAmount
      ) {
        toast(
          'Approved amount is required before payment',
          'error'
        );

        return;
      }

      try {
        setActionLoading(
          `pay-${id}`
        );

        const response =
          await advanceService.updateStatus(
            id,
            'PAID',
            {
              paidAmount,
            }
          );

        const updatedAdvance =
          response?.data ??
          response;

        setAdvances(
          (prev) =>
            prev.map(
              (advance) =>
                advance.advanceId === id
                  ? {
                      ...advance,
                      ...(updatedAdvance ||
                        {}),
                      status:
                        'PAID',
                      paidAmount,
                    }
                  : advance
            )
        );

        toast(
          'Advance payment recorded successfully',
          'success'
        );

        closeModal();
      } catch (error) {
        console.error(
          'Pay advance error:',
          error
        );

        toast(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Failed to record advance payment',
          'error'
        );
      } finally {
        setActionLoading(null);
      }
    };


  // ==========================================================
  // Search
  // ==========================================================

  const filtered =
    useMemo(() => {

      const searchTerm =
        search
          .trim()
          .toLowerCase();

      if (!searchTerm) {
        return advances;
      }

      return advances.filter(
        (advance) => {

          const employeeName =
            getEmployeeName(
              advance
            ).toLowerCase();

          const employeeId =
            String(
              advance?.employeeId ??
                ''
            ).toLowerCase();

          const amount =
            String(
              advance?.amount ??
                ''
            ).toLowerCase();

          const approvedAmount =
            String(
              advance?.approvedAmount ??
                ''
            ).toLowerCase();

          const paidAmount =
            String(
              advance?.paidAmount ??
                ''
            ).toLowerCase();

          const reason =
            String(
              advance?.reason ??
                ''
            ).toLowerCase();

          const status =
            String(
              advance?.status ??
                ''
            ).toLowerCase();

          return (
            employeeName.includes(
              searchTerm
            ) ||
            employeeId.includes(
              searchTerm
            ) ||
            amount.includes(
              searchTerm
            ) ||
            approvedAmount.includes(
              searchTerm
            ) ||
            paidAmount.includes(
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
    }, [advances, search]);


  // ==========================================================
  // Table columns
  // ==========================================================

  const columns = [

    // --------------------------------------------------------
    // Employee ID
    // --------------------------------------------------------

    {
      key: 'employeeId',
      label: 'Emp ID',

      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-600">
          {row.employeeId}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Employee
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Requested amount
    // --------------------------------------------------------

    {
      key: 'amount',
      label: 'Requested',
      align: 'right',

      render: (row) => (
        <span className="font-bold text-navy-900">
          {formatCurrency(
            row.amount
          )}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Approved amount
    // --------------------------------------------------------

    {
      key: 'approvedAmount',
      label: 'Approved',
      align: 'right',

      render: (row) => (
        <div className="text-right">
          <span className="font-semibold text-success-700">
            {formatCurrency(
              row.approvedAmount
            )}
          </span>
        </div>
      ),
    },


    // --------------------------------------------------------
    // Paid amount
    // --------------------------------------------------------

    {
      key: 'paidAmount',
      label: 'Paid',
      align: 'right',

      render: (row) => (
        <div className="text-right">
          <span className="font-semibold text-navy-900">
            {formatCurrency(
              row.paidAmount
            )}
          </span>
        </div>
      ),
    },


    // --------------------------------------------------------
    // Reason
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Payment date
    // --------------------------------------------------------

    {
      key: 'paymentDate',
      label: 'Payment Date',

      render: (row) => (
        <span className="text-navy-500 text-sm">
          {formatDate(
            row.paymentDate ||
              row.createdAt
          )}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Status
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Actions
    // --------------------------------------------------------

    {
      key: 'actions',
      label: 'Actions',
      align: 'right',

      render: (row) => {

        const status =
          getStatus(row);

        const approving =
          actionLoading ===
          `approve-${row.advanceId}`;

        const rejecting =
          actionLoading ===
          `reject-${row.advanceId}`;

        const paying =
          actionLoading ===
          `pay-${row.advanceId}`;


        // ================================================
        // PENDING
        // ================================================

        if (status === 'PENDING') {
          return (
            <div className="flex items-center justify-end gap-2">

              {/* Approve */}
              <button
                type="button"
                onClick={() =>
                  openApproveModal(row)
                }
                disabled={
                  approving ||
                  rejecting
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success-100 text-success-700 hover:bg-success-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Approve advance"
              >
                {approving ? (
                  <RefreshCw
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Check
                    size={15}
                  />
                )}

                Approve
              </button>


              {/* Reject */}
              <button
                type="button"
                onClick={() =>
                  handleReject(
                    row.advanceId
                  )
                }
                disabled={
                  approving ||
                  rejecting
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-error-100 text-error-700 hover:bg-error-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reject advance"
              >
                {rejecting ? (
                  <RefreshCw
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <X
                    size={15}
                  />
                )}

                Reject
              </button>

            </div>
          );
        }


        // ================================================
        // APPROVED
        // ================================================

        if (status === 'APPROVED') {
          return (
            <div className="flex items-center justify-end gap-2">

              {/* Edit approved amount */}
              <button
                type="button"
                onClick={() =>
                  openEditApprovalModal(
                    row
                  )
                }
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-100 text-navy-700 hover:bg-navy-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit approved amount"
              >
                <Pencil
                  size={14}
                />

                Edit
              </button>


              {/* Pay */}
              <button
                type="button"
                onClick={() =>
                  openPayModal(row)
                }
                disabled={
                  paying ||
                  !!actionLoading
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success-100 text-success-700 hover:bg-success-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Record payment"
              >
                {paying ? (
                  <RefreshCw
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <CreditCard
                    size={15}
                  />
                )}

                Pay
              </button>

            </div>
          );
        }


        // ================================================
        // PAID
        // ================================================

        if (status === 'PAID') {
          return (
            <div className="flex items-center justify-end gap-1.5 text-navy-400">
              <Lock
                size={14}
              />

              <span className="text-xs font-medium">
                Locked
              </span>
            </div>
          );
        }


        // ================================================
        // REJECTED / OTHER
        // ================================================

        return (
          <span className="text-navy-300 text-xs">
            —
          </span>
        );
      },
    },
  ];


  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading salary advances..."
      />
    );
  }


  // ==========================================================
  // Main page
  // ==========================================================

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


      {/* ======================================================
          Search + Refresh
          ====================================================== */}

      <div className="mb-5 flex items-center gap-3">

        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name, ID, amount or status..."
          />
        </div>


        <button
          type="button"
          onClick={loadAdvances}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
          title="Refresh salary advances"
        >
          <RefreshCw
            size={16}
          />

          Refresh
        </button>

      </div>


      {/* ======================================================
          Table
          ====================================================== */}

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


      {/* ======================================================
          APPROVE / EDIT APPROVAL MODAL
          ====================================================== */}

      {(modalType === 'approve' ||
        modalType ===
          'edit-approval') &&
        selectedAdvance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">

                <div>
                  <h2 className="text-lg font-semibold text-navy-900">
                    {modalType ===
                    'edit-approval'
                      ? 'Edit Approved Amount'
                      : 'Approve Salary Advance'}
                  </h2>

                  <p className="text-sm text-navy-500 mt-1">
                    {getEmployeeName(
                      selectedAdvance
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  className="p-2 rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                >
                  <X
                    size={20}
                  />
                </button>

              </div>


              {/* Body */}
              <div className="px-6 py-5 space-y-4">

                {/* Requested */}
                <div className="rounded-xl bg-navy-50 p-4">

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-navy-500">
                      Requested Amount
                    </span>

                    <span className="font-bold text-navy-900">
                      {formatCurrency(
                        selectedAdvance.amount
                      )}
                    </span>
                  </div>

                </div>


                {/* Approved amount */}
                <div>

                  <label
                    htmlFor="approvedAmount"
                    className="block text-sm font-medium text-navy-700 mb-2"
                  >
                    Approved Amount
                  </label>

                  <input
                    id="approvedAmount"
                    type="number"
                    min="1"
                    max={Number(
                      selectedAdvance.amount
                    )}
                    step="0.01"
                    value={
                      amountInput
                    }
                    onChange={(event) =>
                      setAmountInput(
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                    placeholder="Enter approved amount"
                    autoFocus
                  />

                  <p className="mt-2 text-xs text-navy-400">
                    Maximum approved amount:{' '}
                    {formatCurrency(
                      selectedAdvance.amount
                    )}
                  </p>

                </div>

              </div>


              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-navy-100 px-6 py-4">

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  className="px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleApproveSubmit
                  }
                  disabled={
                    actionLoading !==
                      null
                  }
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >

                  {actionLoading !==
                  null ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Check
                      size={16}
                    />
                  )}

                  {modalType ===
                  'edit-approval'
                    ? 'Save Amount'
                    : 'Approve'}
                </button>

              </div>

            </div>

          </div>
        )}


      {/* ======================================================
          PAYMENT MODAL
          ====================================================== */}

      {modalType === 'pay' &&
        selectedAdvance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">

                <div>
                  <h2 className="text-lg font-semibold text-navy-900">
                    Record Advance Payment
                  </h2>

                  <p className="text-sm text-navy-500 mt-1">
                    {getEmployeeName(
                      selectedAdvance
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  className="p-2 rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                >
                  <X
                    size={20}
                  />
                </button>

              </div>


              {/* Body */}
              <div className="px-6 py-5 space-y-4">

                {/* Requested */}
                <div className="rounded-xl bg-navy-50 p-4">

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-navy-500">
                      Requested
                    </span>

                    <span className="font-semibold text-navy-900">
                      {formatCurrency(
                        selectedAdvance.amount
                      )}
                    </span>
                  </div>

                </div>


                {/* Approved */}
                <div className="rounded-xl bg-success-50 p-4">

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-success-700">
                      Approved
                    </span>

                    <span className="font-bold text-success-700">
                      {formatCurrency(
                        selectedAdvance.approvedAmount
                      )}
                    </span>
                  </div>

                </div>


                {/* Actual paid amount */}
                <div>

                  <label
                    htmlFor="paidAmount"
                    className="block text-sm font-medium text-navy-700 mb-2"
                  >
                    Actual Paid Amount
                  </label>

                  <input
                    id="paidAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      amountInput
                    }
                    onChange={(event) =>
                      setAmountInput(
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-navy-200 px-4 py-3 text-navy-900 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                    placeholder="Enter actual amount paid"
                    autoFocus
                  />

                  <p className="mt-2 text-xs text-navy-400">
                    This is the actual amount paid to the employee.
                  </p>

                </div>


                {/* Lock warning */}
                <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">

                  <Lock
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Payment will lock this advance
                    </p>

                    <p className="text-xs text-amber-700 mt-1">
                      After you confirm the payment, the advance will become PAID and the financial amounts cannot be changed.
                    </p>
                  </div>

                </div>

              </div>


              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-navy-100 px-6 py-4">

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  className="px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handlePaySubmit
                  }
                  disabled={
                    actionLoading !==
                      null
                  }
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-success-600 text-white hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >

                  {actionLoading !==
                  null ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <CreditCard
                      size={16}
                    />
                  )}

                  Confirm Payment
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}