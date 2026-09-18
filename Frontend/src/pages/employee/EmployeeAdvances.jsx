import { useEffect, useMemo, useState } from 'react';

import {
  Banknote,
  Plus,
  RefreshCw,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import {
  selfService,
} from '@/services/apiServices';


// ============================================================
// EMPLOYEE ADVANCES
// ============================================================

export function EmployeeAdvances() {

  const { toast } = useToast();

  const [advances, setAdvances] =
    useState([]);

  const [employeeProfile, setEmployeeProfile] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [modalOpen, setModalOpen] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);


  // ==========================================================
  // Calculate employee advance eligibility
  //
  // Salary comes from the employee profile first. This is important
  // for employees who have never requested an advance before and
  // therefore do not yet have an advance record containing salary.
  // The advance list is kept as a fallback for compatibility.
  // ==========================================================

  const employeeBaseSalary =
    useMemo(() => {

      const profileSalary =
        Number(
          employeeProfile?.baseSalary
        );

      if (
        Number.isFinite(profileSalary) &&
        profileSalary > 0
      ) {
        return profileSalary;
      }

      const recordWithSalary =
        advances.find(
          (advance) =>
            advance?.employee?.baseSalary !==
              undefined &&
            advance?.employee?.baseSalary !==
              null
        );

      return recordWithSalary
        ? Number(
            recordWithSalary.employee.baseSalary
          ) || 0
        : 0;
    }, [employeeProfile, advances]);


  const outstandingAdvance =
    useMemo(() => {

      return advances.reduce(
        (total, advance) => {

          const status =
            String(
              advance?.status || ''
            )
              .trim()
              .toUpperCase();

          // Already recovered through a paid payroll.
          if (advance?.deductedAt) {
            return total;
          }

          // Legacy safety case: an old record may already point to
          // a payroll that has been paid even if deductedAt is null.
          if (
            status === 'PAID' &&
            advance?.deductedInPayroll?.status ===
              'PAID'
          ) {
            return total;
          }

          let amount = 0;

          if (status === 'PENDING') {
            amount =
              Number(advance?.amount) ||
              0;
          } else if (status === 'APPROVED') {
            amount =
              Number(
                advance?.approvedAmount ??
                  advance?.amount
              ) || 0;
          } else if (status === 'PAID') {
            amount =
              Number(advance?.paidAmount) ||
              0;
          }

          return total + Math.max(0, amount);
        },
        0
      );
    }, [advances]);


  const availableAdvance =
    Math.max(
      0,
      employeeBaseSalary -
        outstandingAdvance
    );


  const salaryLimitKnown =
    employeeBaseSalary > 0;


  // ==========================================================
  // Load employee profile + advances
  // ==========================================================

  const loadAdvances = async () => {

    try {

      setLoading(true);

      const [
        profileResult,
        advancesResult
      ] = await Promise.allSettled([
        selfService.profile(),
        selfService.advances(),
      ]);

      let profile = null;

      if (
        profileResult.status ===
        'fulfilled'
      ) {

        profile =
          profileResult.value?.data ??
          profileResult.value ??
          null;

        setEmployeeProfile(profile);

      } else {

        console.error(
          'Failed to load employee profile:',
          profileResult.reason
        );

        setEmployeeProfile(null);
      }

      let records = [];

      if (
        advancesResult.status ===
        'fulfilled'
      ) {

        const response =
          advancesResult.value;

        if (Array.isArray(response)) {

          records = response;

        } else if (
          Array.isArray(response?.data)
        ) {

          records = response.data;

        }

        setAdvances(records);

      } else {

        console.error(
          'Failed to load advances:',
          advancesResult.reason
        );

        setAdvances([]);
      }

      if (
        profileResult.status === 'rejected' &&
        advancesResult.status === 'rejected'
      ) {

        toast(
          'Failed to load your advance information',
          'error'
        );

      } else if (
        advancesResult.status === 'rejected'
      ) {

        toast(
          advancesResult.reason?.response?.data?.message ||
            advancesResult.reason?.message ||
            'Failed to load your advance requests',
          'error'
        );

      } else if (
        profileResult.status === 'rejected' &&
        records.length === 0
      ) {

        toast(
          'Unable to determine your salary limit. Please refresh and try again.',
          'error'
        );

      }

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

  const formatCurrency = (
    amount
  ) => {

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
      Number.isNaN(
        numericAmount
      )
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

  const formatDate = (
    date
  ) => {

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
  // Submit employee advance request
  // ==========================================================

  const handleApply = async (
    data
  ) => {

    try {

      setSubmitting(true);

      /*
       * IMPORTANT:
       * Employee requests must use:
       *
       * POST /api/me/advances
       *
       * not:
       *
       * POST /api/advances
       */

      const response =
        await selfService.createAdvance(
          data
        );

      // The backend is the source of truth. Reload the records after
      // a successful request so the salary/outstanding/available values
      // immediately reflect the new PENDING advance.
      await loadAdvances();

      toast(
        'Advance request submitted successfully',
        'success'
      );

      setModalOpen(false);

    } catch (error) {

      console.error(
        'Failed to submit advance request:',
        error
      );

      /*
       * DO NOT create a fake local record.
       * The database is the source of truth.
       */

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to submit advance request',
        'error'
      );

    } finally {

      setSubmitting(false);

    }
  };


  // ==========================================================
  // Table columns
  // ==========================================================

  const columns = [

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
        <span className="font-semibold text-success-700">
          {formatCurrency(
            row.approvedAmount
          )}
        </span>
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
        <span className="font-semibold text-navy-900">
          {formatCurrency(
            row.paidAmount
          )}
        </span>
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
    // Payment / requested date
    // --------------------------------------------------------

    {
      key: 'paymentDate',

      label: 'Requested Date',

      render: (row) => (
        <span className="text-navy-400 text-sm">
          {formatDate(
            row.createdAt ||
              row.paymentDate
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

  ];


  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading your advances..."
      />
    );

  }


  // ==========================================================
  // Page
  // ==========================================================

  return (
    <div>

      <PageHeader
        title="My Advances"
        subtitle="Your salary advance requests"

        actions={

          <button
            type="button"
            onClick={() =>
              setModalOpen(true)
            }
            disabled={
              submitting ||
              !salaryLimitKnown ||
              availableAdvance < 1000
            }
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />

            Request Advance
          </button>

        }
      />


      {!salaryLimitKnown && (

        <div className="mb-5 rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
          Unable to determine your monthly salary limit. Please refresh the page before requesting an advance.
        </div>

      )}


      {/* ======================================================
          Advance eligibility summary
          ====================================================== */}

      {salaryLimitKnown && (

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-xl border border-navy-100 bg-navy-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-400">
              Monthly Base Salary
            </p>
            <p className="mt-1 text-xl font-bold text-navy-900">
              {formatCurrency(employeeBaseSalary)}
            </p>
          </div>

          <div className="rounded-xl border border-error-100 bg-error-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-error-500">
              Outstanding Advance
            </p>
            <p className="mt-1 text-xl font-bold text-error-700">
              {formatCurrency(outstandingAdvance)}
            </p>
          </div>

          <div className="rounded-xl border border-success-100 bg-success-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-success-600">
              Available Advance
            </p>
            <p className="mt-1 text-xl font-bold text-success-700">
              {formatCurrency(availableAdvance)}
            </p>
          </div>

        </div>
      )}


      {/* ======================================================
          Refresh
          ====================================================== */}

      <div className="mb-5 flex justify-end">

        <button
          type="button"
          onClick={loadAdvances}
          disabled={loading || submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >

          <RefreshCw
            size={16}
          />

          Refresh

        </button>

      </div>


      {/* ======================================================
          Advance table
          ====================================================== */}

      {advances.length === 0 ? (

        <EmptyState
          icon={Banknote}
          title="No advance requests"
          message="You haven't requested any salary advances."
        />

      ) : (

        <DataTable
          columns={columns}
          data={advances}
        />

      )}


      {/* ======================================================
          Request Advance Modal
          ====================================================== */}

      <Modal
        open={modalOpen}
        onClose={() =>
          !submitting &&
          setModalOpen(false)
        }
        title="Request Salary Advance"
      >

        <AdvanceForm
          onCancel={() =>
            !submitting &&
            setModalOpen(false)
          }
          onSave={handleApply}
          submitting={submitting}
          maxAdvanceAmount={
            salaryLimitKnown
              ? availableAdvance
              : null
          }
          outstandingAdvance={
            salaryLimitKnown
              ? outstandingAdvance
              : null
          }
          baseSalary={
            salaryLimitKnown
              ? employeeBaseSalary
              : null
          }
        />

      </Modal>

    </div>
  );
}


// ============================================================
// ADVANCE FORM
// ============================================================

function AdvanceForm({
  onCancel,
  onSave,
  submitting,
  maxAdvanceAmount = null,
  outstandingAdvance = null,
  baseSalary = null,
}) {

  const [form, setForm] =
    useState({
      amount: '',
      reason: '',
      paymentDate: '',
    });

  const [validationError, setValidationError] =
    useState('');

  const formatFormCurrency = (
    amount
  ) => {
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount)
    ) {
      return '₹0';
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
  // Handle field change
  // ==========================================================

  const handleChange = (
    field,
    value
  ) => {

    setValidationError('');

    setForm(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );

  };


  // ==========================================================
  // Submit
  // ==========================================================

  const handleSubmit = (
    event
  ) => {

    event.preventDefault();

    const amount =
      Number(form.amount);

    if (
      !Number.isFinite(amount) ||
      amount < 1000
    ) {
      setValidationError(
        'Advance amount must be at least ₹1,000.'
      );
      return;
    }

    if (
      maxAdvanceAmount !== null &&
      amount > Number(maxAdvanceAmount)
    ) {
      setValidationError(
        `You can request a maximum of ${formatFormCurrency(
          maxAdvanceAmount
        )}. Your existing outstanding advances are already counted.`
      );
      return;
    }

    if (
      !form.reason.trim()
    ) {
      return;
    }

    if (
      !form.paymentDate
    ) {
      return;
    }


    onSave({
      amount,
      reason:
        form.reason.trim(),
      paymentDate:
        form.paymentDate,
    });

  };


  // ==========================================================
  // Form
  // ==========================================================

  return (

    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-4"
    >

      {/* ======================================================
          Amount
          ====================================================== */}

      <div className="flex flex-col gap-1.5">

        <label
          htmlFor="advance-amount"
          className="text-sm font-medium text-navy-700"
        >
          Amount (₹)

          <span className="text-error-500">
            {' '}*
          </span>
        </label>


        <input
          id="advance-amount"
          type="number"
          min="1000"
          max={
            maxAdvanceAmount !== null
              ? maxAdvanceAmount
              : undefined
          }
          step="500"
          className="input-field"
          value={
            form.amount
          }
          onChange={(event) =>
            handleChange(
              'amount',
              event.target.value
            )
          }
          placeholder="Enter amount"
          required
          disabled={submitting}
        />


        <p className="text-xs text-navy-400">
          Minimum ₹1,000. Your existing outstanding advances reduce the amount you can request.
        </p>

      </div>


      {maxAdvanceAmount !== null && (

        <div className="rounded-xl border border-navy-100 bg-navy-50 p-4">

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            <div>
              <p className="text-xs text-navy-400">Monthly Salary</p>
              <p className="mt-1 font-semibold text-navy-900">
                {formatFormCurrency(baseSalary)}
              </p>
            </div>

            <div>
              <p className="text-xs text-navy-400">Outstanding</p>
              <p className="mt-1 font-semibold text-error-700">
                {formatFormCurrency(outstandingAdvance)}
              </p>
            </div>

            <div>
              <p className="text-xs text-navy-400">Maximum You Can Request</p>
              <p className="mt-1 font-semibold text-success-700">
                {formatFormCurrency(maxAdvanceAmount)}
              </p>
            </div>

          </div>

        </div>
      )}


      {validationError && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2.5 text-sm text-error-700">
          {validationError}
        </div>
      )}


      {/* ======================================================
          Payment date
          ====================================================== */}

      <div className="flex flex-col gap-1.5">

        <label
          htmlFor="advance-payment-date"
          className="text-sm font-medium text-navy-700"
        >
          Required Payment Date

          <span className="text-error-500">
            {' '}*
          </span>
        </label>


        <input
          id="advance-payment-date"
          type="date"
          className="input-field"
          value={
            form.paymentDate
          }
          onChange={(event) =>
            handleChange(
              'paymentDate',
              event.target.value
            )
          }
          required
          disabled={submitting}
        />


        <p className="text-xs text-navy-400">
          Select the date by which you are requesting the advance.
        </p>

      </div>


      {/* ======================================================
          Reason
          ====================================================== */}

      <div className="flex flex-col gap-1.5">

        <label
          htmlFor="advance-reason"
          className="text-sm font-medium text-navy-700"
        >
          Reason

          <span className="text-error-500">
            {' '}*
          </span>
        </label>


        <textarea
          id="advance-reason"
          className="input-field"
          rows={3}
          value={
            form.reason
          }
          onChange={(event) =>
            handleChange(
              'reason',
              event.target.value
            )
          }
          placeholder="Enter reason for requesting the advance"
          required
          disabled={submitting}
        />

      </div>


      {/* ======================================================
          Information
          ====================================================== */}

      <div className="rounded-xl bg-navy-50 p-4">

        <p className="text-xs leading-5 text-navy-500">

          Your request will first be marked as{' '}

          <strong className="text-navy-700">
            PENDING
          </strong>

          . An administrator will review it and may approve an amount lower than the amount you requested. The requested amount cannot be greater than your monthly base salary.

        </p>

      </div>


      {/* ======================================================
          Buttons
          ====================================================== */}

      <div className="flex justify-end gap-3 pt-2">

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>


        <button
          type="submit"
          disabled={submitting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >

          {submitting ? (

            <>

              <RefreshCw
                size={16}
                className="animate-spin"
              />

              Submitting...

            </>

          ) : (

            'Submit Request'

          )}

        </button>

      </div>

    </form>

  );
}