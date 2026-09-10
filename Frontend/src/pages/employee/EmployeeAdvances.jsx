import { useEffect, useState } from 'react';

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

  const [loading, setLoading] =
    useState(true);

  const [modalOpen, setModalOpen] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);


  // ==========================================================
  // Load employee advances
  // ==========================================================

  const loadAdvances = async () => {

    try {

      setLoading(true);

      const response =
        await selfService.advances();

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
        'Failed to load advances:',
        error
      );

      setAdvances([]);

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load your advance requests',
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

      const createdAdvance =
        response?.data ??
        response;

      /*
       * Only update the UI after
       * the backend successfully stores
       * the request.
       */

      if (
        createdAdvance &&
        typeof createdAdvance ===
          'object'
      ) {

        setAdvances(
          (prev) => [
            createdAdvance,
            ...prev,
          ]
        );

      } else {

        /*
         * If backend response does not
         * contain the created record,
         * reload from database.
         */

        await loadAdvances();

      }

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
            disabled={submitting}
            className="btn-primary"
          >
            <Plus size={18} />

            Request Advance
          </button>

        }
      />


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
}) {

  const [form, setForm] =
    useState({
      amount: '',
      reason: '',
      paymentDate: '',
    });


  // ==========================================================
  // Handle field change
  // ==========================================================

  const handleChange = (
    field,
    value
  ) => {

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
          Minimum ₹1,000
        </p>

      </div>


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

          . An administrator will review it and may approve an amount lower than the amount you requested.

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