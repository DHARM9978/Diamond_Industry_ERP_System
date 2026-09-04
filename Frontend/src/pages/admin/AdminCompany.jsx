import { useEffect, useState } from 'react';

import {
  Building2,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Calendar,
  RefreshCw,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import {
  companyService,
  branchService,
  employeeService,
} from '@/services/apiServices';


// ======================================================
// ADMIN COMPANY
// ======================================================

export function AdminCompany() {

  const { toast } = useToast();

  const [company, setCompany] =
    useState(null);

  const [branchCount, setBranchCount] =
    useState(0);

  const [employeeCount, setEmployeeCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [modalOpen, setModalOpen] =
    useState(false);


  // ====================================================
  // LOAD COMPANY DATA
  // ====================================================

  const loadCompany = async () => {

    try {

      setLoading(true);

      /*
       * Load all three APIs together.
       *
       * Company:
       * GET /api/companies
       *
       * Branches:
       * GET /api/branches
       *
       * Employees:
       * GET /api/employees
       */

      const [
        companyResponse,
        branchResponse,
        employeeResponse,
      ] = await Promise.all([
        companyService.list(),
        branchService.list(),
        employeeService.list(),
      ]);


      // =================================================
      // COMPANY
      // =================================================

      let companies = [];

      if (
        Array.isArray(companyResponse)
      ) {

        companies =
          companyResponse;

      } else if (
        Array.isArray(
          companyResponse?.data
        )
      ) {

        companies =
          companyResponse.data;
      }


      if (companies.length === 0) {

        setCompany(null);

        toast(
          'No company information found',
          'warning'
        );

        return;
      }


      /*
       * Current API contains:
       *
       * company_id: 1
       * company_id: 2
       *
       * The current admin is associated
       * with company 1.
       *
       * For now we use the first company.
       *
       * Later we can use companyId directly
       * from the JWT/AuthContext.
       */

      setCompany(
        companies[0]
      );


      // =================================================
      // BRANCH COUNT
      // =================================================

      let branches = [];

      if (
        Array.isArray(branchResponse)
      ) {

        branches =
          branchResponse;

      } else if (
        Array.isArray(
          branchResponse?.data
        )
      ) {

        branches =
          branchResponse.data;
      }

      setBranchCount(
        branches.length
      );


      // =================================================
      // EMPLOYEE COUNT
      // =================================================

      let employees = [];

      if (
        Array.isArray(employeeResponse)
      ) {

        employees =
          employeeResponse;

      } else if (
        Array.isArray(
          employeeResponse?.data
        )
      ) {

        employees =
          employeeResponse.data;
      }

      setEmployeeCount(
        employees.length
      );

    } catch (error) {

      console.error(
        'Failed to load company data:',
        error
      );

      setCompany(null);

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to load company information',
        'error'
      );

    } finally {

      setLoading(false);
    }
  };


  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {

    loadCompany();

  }, []);


  // ====================================================
  // FORMAT DATE
  // ====================================================

  const formatDate = (date) => {

    if (!date) {
      return '—';
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return '—';
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


  // ====================================================
  // SAVE COMPANY
  // ====================================================

  const handleSave = async (
    formData
  ) => {

    if (!company?.company_id) {

      toast(
        'Company ID is missing',
        'error'
      );

      return;
    }


    try {

      setSaving(true);


      /*
       * IMPORTANT:
       *
       * These are the exact database field names.
       */

      const payload = {

        company_name:
          formData.company_name.trim(),

        address:
          formData.address.trim(),

        contact_email:
          formData.contact_email.trim(),

        contact_phone:
          formData.contact_phone.trim() ||
          null,
      };


      console.log(
        'Updating company:',
        company.company_id,
        payload
      );


      const response =
        await companyService.update(
          company.company_id,
          payload
        );


      console.log(
        'Company update response:',
        response
      );


      /*
       * Backend response:
       *
       * {
       *   success: true,
       *   message: "Company updated successfully",
       *   data: {...}
       * }
       */

      let updatedCompany = null;


      if (
        response?.data &&
        !Array.isArray(
          response.data
        )
      ) {

        updatedCompany =
          response.data;

      } else if (
        response?.company_id
      ) {

        updatedCompany =
          response;
      }


      // =================================================
      // UPDATE LOCAL STATE
      // =================================================

      if (updatedCompany) {

        setCompany(
          updatedCompany
        );

      } else {

        setCompany((previous) => ({
          ...previous,
          ...payload,
        }));

      }


      toast(
        'Company updated successfully',
        'success'
      );


      setModalOpen(false);


      /*
       * Reload from database.
       *
       * This is important:
       * if the update didn't actually persist,
       * this reload will expose the problem.
       */

      await loadCompany();

    } catch (error) {

      console.error(
        'Company update failed:',
        error
      );

      toast(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to update company',
        'error'
      );

    } finally {

      setSaving(false);
    }
  };


  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading company information..."
      />
    );
  }


  // ====================================================
  // COMPANY NOT FOUND
  // ====================================================

  if (!company) {

    return (
      <div>

        <PageHeader
          title="Company"
          subtitle="Organization details and overview"
        />

        <div className="card p-8 text-center">

          <Building2
            size={42}
            className="mx-auto text-navy-300 mb-3"
          />

          <h2 className="text-lg font-semibold text-navy-800">
            Company information unavailable
          </h2>

          <p className="text-sm text-navy-500 mt-1 mb-5">
            No company information could be loaded.
          </p>

          <button
            type="button"
            onClick={loadCompany}
            className="btn-primary mx-auto"
          >
            <RefreshCw size={16} />
            Try Again
          </button>

        </div>

      </div>
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div>

      <PageHeader
        title="Company"
        subtitle="Organization details and overview"
        actions={
          <div className="flex items-center gap-3">

            {/* Refresh */}
            <button
              type="button"
              onClick={loadCompany}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors"
            >
              <RefreshCw size={17} />
              Refresh
            </button>


            {/* Edit */}
            <button
              type="button"
              onClick={() =>
                setModalOpen(true)
              }
              className="btn-secondary"
            >
              <Pencil size={18} />
              Edit
            </button>

          </div>
        }
      />


      {/* ==================================================
          SUMMARY CARDS
          ================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        {/* Branches */}

        <StatCard
          icon={Building2}
          label="Branches"
          value={branchCount}
          color="navy"
        />


        {/* Employees */}

        <StatCard
          icon={Building2}
          label="Total Employees"
          value={employeeCount}
          color="accent"
        />


        {/* Established */}

        <StatCard
          icon={Calendar}
          label="Established"
          value="—"
          color="success"
        />


        {/* GSTIN */}

        <StatCard
          icon={Building2}
          label="GSTIN"
          value="—"
          color="warning"
        />

      </div>


      {/* ==================================================
          COMPANY DETAILS
          ================================================== */}

      <div className="card p-6">

        {/* Header */}

        <div className="flex items-center gap-4 mb-8">

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center">

            <Building2
              size={28}
              className="text-white"
            />

          </div>


          <div>

            <h2 className="text-xl font-bold text-navy-900">
              {company.company_name}
            </h2>

            <p className="text-sm text-navy-500">
              Diamond Industry Enterprise
            </p>

          </div>

        </div>


        {/* Information */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">

          {/* ============================================
              LEFT
              ============================================ */}

          <div className="space-y-6">

            {/* Email */}

            <div className="flex items-start gap-3">

              <Mail
                size={19}
                className="text-navy-400 mt-0.5"
              />

              <div>

                <p className="text-xs font-medium text-navy-400 uppercase">
                  Email
                </p>

                <p className="text-sm text-navy-800 mt-1">
                  {company.contact_email ||
                    'Not provided'}
                </p>

              </div>

            </div>


            {/* Phone */}

            <div className="flex items-start gap-3">

              <Phone
                size={19}
                className="text-navy-400 mt-0.5"
              />

              <div>

                <p className="text-xs font-medium text-navy-400 uppercase">
                  Phone
                </p>

                <p className="text-sm text-navy-800 mt-1">
                  {company.contact_phone ||
                    'Not provided'}
                </p>

              </div>

            </div>


            {/* Company ID */}

            <div className="flex items-start gap-3">

              <Building2
                size={19}
                className="text-navy-400 mt-0.5"
              />

              <div>

                <p className="text-xs font-medium text-navy-400 uppercase">
                  Company ID
                </p>

                <p className="text-sm text-navy-800 mt-1 font-mono">
                  {company.company_id}
                </p>

              </div>

            </div>

          </div>


          {/* ============================================
              RIGHT
              ============================================ */}

          <div className="space-y-6">

            {/* Address */}

            <div className="flex items-start gap-3">

              <MapPin
                size={19}
                className="text-navy-400 mt-0.5"
              />

              <div>

                <p className="text-xs font-medium text-navy-400 uppercase">
                  Address
                </p>

                <p className="text-sm text-navy-800 mt-1">
                  {company.address ||
                    'Not provided'}
                </p>

              </div>

            </div>


            {/* Created */}

            <div className="flex items-start gap-3">

              <Calendar
                size={19}
                className="text-navy-400 mt-0.5"
              />

              <div>

                <p className="text-xs font-medium text-navy-400 uppercase">
                  Created
                </p>

                <p className="text-sm text-navy-800 mt-1">
                  {formatDate(
                    company.created_at
                  )}
                </p>

              </div>

            </div>


            {/* Updated */}

            <div className="flex items-start gap-3">

              <RefreshCw
                size={19}
                className="text-navy-400 mt-0.5"
              />

              <div>

                <p className="text-xs font-medium text-navy-400 uppercase">
                  Last Updated
                </p>

                <p className="text-sm text-navy-800 mt-1">
                  {formatDate(
                    company.updated_at
                  )}
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>


      {/* ==================================================
          EDIT MODAL
          ================================================== */}

      <Modal
        open={modalOpen}
        onClose={() => {

          if (!saving) {
            setModalOpen(false);
          }

        }}
        title="Edit Company"
      >

        <CompanyForm
          company={company}
          saving={saving}
          onCancel={() => {

            if (!saving) {
              setModalOpen(false);
            }

          }}
          onSave={handleSave}
        />

      </Modal>

    </div>
  );
}


// ======================================================
// COMPANY FORM
// ======================================================

function CompanyForm({
  company,
  saving,
  onCancel,
  onSave,
}) {

  const [form, setForm] = useState({

    company_name:
      company?.company_name || '',

    contact_email:
      company?.contact_email || '',

    contact_phone:
      company?.contact_phone || '',

    address:
      company?.address || '',

  });


  // ====================================================
  // HANDLE INPUT
  // ====================================================

  const handleChange = (
    field,
    value
  ) => {

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

  };


  // ====================================================
  // SUBMIT
  // ====================================================

  const handleSubmit = (
    event
  ) => {

    event.preventDefault();

    onSave(form);

  };


  // ====================================================
  // FORM
  // ====================================================

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >

      {/* Company Name */}

      <div className="flex flex-col gap-1.5">

        <label className="text-sm font-medium text-navy-700">
          Company Name
        </label>

        <input
          type="text"
          className="input-field"
          value={form.company_name}
          onChange={(event) =>
            handleChange(
              'company_name',
              event.target.value
            )
          }
          placeholder="Enter company name"
          required
          disabled={saving}
        />

      </div>


      {/* Email + Phone */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Email */}

        <div className="flex flex-col gap-1.5">

          <label className="text-sm font-medium text-navy-700">
            Email
          </label>

          <input
            type="email"
            className="input-field"
            value={form.contact_email}
            onChange={(event) =>
              handleChange(
                'contact_email',
                event.target.value
              )
            }
            placeholder="admin@company.com"
            disabled={saving}
          />

        </div>


        {/* Phone */}

        <div className="flex flex-col gap-1.5">

          <label className="text-sm font-medium text-navy-700">
            Phone
          </label>

          <input
            type="tel"
            className="input-field"
            value={form.contact_phone}
            onChange={(event) =>
              handleChange(
                'contact_phone',
                event.target.value
              )
            }
            placeholder="9876543210"
            disabled={saving}
          />

        </div>

      </div>


      {/* Address */}

      <div className="flex flex-col gap-1.5">

        <label className="text-sm font-medium text-navy-700">
          Address
        </label>

        <textarea
          className="input-field"
          rows={3}
          value={form.address}
          onChange={(event) =>
            handleChange(
              'address',
              event.target.value
            )
          }
          placeholder="Enter company address"
          disabled={saving}
        />

      </div>


      {/* Company ID */}

      <div className="flex flex-col gap-1.5">

        <label className="text-sm font-medium text-navy-700">
          Company ID
        </label>

        <input
          type="text"
          className="input-field bg-navy-50"
          value={
            company?.company_id || ''
          }
          disabled
        />

        <p className="text-xs text-navy-400">
          Company ID cannot be changed.
        </p>

      </div>


      {/* Buttons */}

      <div className="flex justify-end gap-3 pt-2">

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn-secondary disabled:opacity-50"
        >
          Cancel
        </button>


        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >

          {saving ? (

            <>
              <RefreshCw
                size={16}
                className="animate-spin"
              />

              Saving...
            </>

          ) : (

            <>
              <Pencil size={16} />
              Save Changes
            </>

          )}

        </button>

      </div>

    </form>
  );
}