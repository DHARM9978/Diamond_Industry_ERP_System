import { useState, useEffect } from 'react';
import { Network, Plus, Pencil, Trash2 } from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import { branchService } from '@/services/apiServices';


export function AdminBranches() {

  const { toast } = useToast();

  // ==========================================================
  // STATE
  // ==========================================================

  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState(null);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');


  // ==========================================================
  // LOAD BRANCHES
  // ==========================================================

  const loadBranches = async () => {

    try {

      setLoading(true);
      setError('');

      const response = await branchService.list();

      /*
       * apiServices.js unwrap() should normally return:
       *
       * [
       *   {
       *     branchId,
       *     branchName,
       *     location,
       *     companyId,
       *     createdAt,
       *     updatedAt
       *   }
       * ]
       */

      const data =
        Array.isArray(response)
          ? response
          : response?.data || [];

      setBranches(data);

    } catch (err) {

      console.error(
        'Failed to load branches:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load branches';

      setError(message);

      toast(
        message,
        'error'
      );

    } finally {

      setLoading(false);

    }
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadBranches();

  }, []);


  // ==========================================================
  // ADD BRANCH
  // ==========================================================

  const handleAdd = () => {

    setEditing(null);

    setModalOpen(true);

  };


  // ==========================================================
  // EDIT BRANCH
  // ==========================================================

  const handleEdit = (branch) => {

    setEditing(branch);

    setModalOpen(true);

  };


  // ==========================================================
  // DELETE BRANCH
  // ==========================================================

  const handleDelete = async (branch) => {

    const confirmed = window.confirm(
      `Are you sure you want to delete "${branch.branchName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {

      await branchService.delete(
        branch.branchId
      );

      toast(
        'Branch deleted successfully',
        'success'
      );

      await loadBranches();

    } catch (err) {

      console.error(
        'Failed to delete branch:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete branch';

      toast(
        message,
        'error'
      );

    }

  };


  // ==========================================================
  // SAVE BRANCH
  // ==========================================================

  const handleSave = async (formData) => {

    try {

      setSaving(true);

      // ------------------------------------------------------
      // UPDATE
      // ------------------------------------------------------

      if (editing) {

        await branchService.update(
          editing.branchId,
          {
            branchName: formData.branchName,
            location: formData.location,
          }
        );

        toast(
          'Branch updated successfully',
          'success'
        );

      }

      // ------------------------------------------------------
      // CREATE
      // ------------------------------------------------------

      else {

        await branchService.create(
          {
            branchName: formData.branchName,
            location: formData.location,
          }
        );

        toast(
          'Branch added successfully',
          'success'
        );

      }

      // ------------------------------------------------------
      // Reload from database
      // ------------------------------------------------------

      await loadBranches();

      setModalOpen(false);

      setEditing(null);

    } catch (err) {

      console.error(
        'Failed to save branch:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save branch';

      toast(
        message,
        'error'
      );

    } finally {

      setSaving(false);

    }

  };


  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

  const columns = [

    {
      key: 'branchName',

      label: 'Branch',

      render: (branch) => (

        <span className="font-medium text-navy-900">

          {branch.branchName || '—'}

        </span>

      ),
    },


    {
      key: 'location',

      label: 'Location',

      render: (branch) => (

        <span className="text-sm text-navy-600">

          {branch.location || '—'}

        </span>

      ),
    },


    {
      key: 'companyId',

      label: 'Company ID',

      align: 'center',

      render: (branch) => (

        <span className="font-semibold text-navy-700">

          {branch.companyId ?? '—'}

        </span>

      ),
    },


    {
      key: 'createdAt',

      label: 'Created',

      render: (branch) => {

        if (!branch.createdAt) {
          return (
            <span className="text-sm text-navy-400">
              —
            </span>
          );
        }

        const date =
          new Date(branch.createdAt);

        return (

          <span className="text-sm text-navy-600">

            {date.toLocaleDateString()}

          </span>

        );

      },
    },


    {
      key: 'actions',

      label: '',

      align: 'right',

      render: (branch) => (

        <div className="flex items-center justify-end gap-1">

          {/* EDIT */}

          <button
            type="button"
            onClick={() =>
              handleEdit(branch)
            }
            className="
              p-2
              rounded-lg
              text-navy-400
              hover:bg-navy-100
              hover:text-navy-700
              transition-colors
            "
            title="Edit branch"
          >

            <Pencil size={16} />

          </button>


          {/* DELETE */}

          <button
            type="button"
            onClick={() =>
              handleDelete(branch)
            }
            className="
              p-2
              rounded-lg
              text-red-400
              hover:bg-red-50
              hover:text-red-600
              transition-colors
            "
            title="Delete branch"
          >

            <Trash2 size={16} />

          </button>

        </div>

      ),
    },

  ];


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading branches..."
      />
    );

  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <div>

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader

        title="Branches"

        subtitle={
          `${branches.length} branch${
            branches.length !== 1
              ? 'es'
              : ''
          }`
        }

        actions={

          <button
            type="button"
            onClick={handleAdd}
            className="btn-primary"
          >

            <Plus size={18} />

            Add Branch

          </button>

        }

      />


      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (

        <div
          className="
            mb-4
            rounded-lg
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            text-red-700
          "
        >

          {error}

        </div>

      )}


      {/* =====================================================
          BRANCH TABLE
      ====================================================== */}

      {branches.length === 0 ? (

        <EmptyState

          icon={Network}

          title="No branches"

          message="Add branches to organize your workforce."

        />

      ) : (

        <DataTable

          columns={columns}

          data={branches}

        />

      )}


      {/* =====================================================
          ADD / EDIT MODAL
      ====================================================== */}

      <Modal

        open={modalOpen}

        onClose={() => {

          if (!saving) {

            setModalOpen(false);

            setEditing(null);

          }

        }}

        title={
          editing
            ? 'Edit Branch'
            : 'Add Branch'
        }

      >

        <BranchForm

          editing={editing}

          saving={saving}

          onCancel={() => {

            if (!saving) {

              setModalOpen(false);

              setEditing(null);

            }

          }}

          onSave={handleSave}

        />

      </Modal>

    </div>

  );

}


// ============================================================
// BRANCH FORM
// ============================================================

function BranchForm({
  editing,
  saving,
  onCancel,
  onSave,
}) {

  const [form, setForm] = useState({

    branchName:
      editing?.branchName || '',

    location:
      editing?.location || '',

  });


  // ==========================================================
  // UPDATE FIELD
  // ==========================================================

  const handleChange = (
    field,
    value
  ) => {

    setForm((previous) => ({

      ...previous,

      [field]: value,

    }));

  };


  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = (
    event
  ) => {

    event.preventDefault();

    onSave(form);

  };


  // ==========================================================
  // FORM
  // ==========================================================

  return (

    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >

      {/* ====================================================
          BRANCH NAME
      ===================================================== */}

      <div className="flex flex-col gap-1.5">

        <label
          className="
            text-sm
            font-medium
            text-navy-700
          "
        >

          Branch Name

        </label>

        <input

          type="text"

          className="input-field"

          value={form.branchName}

          onChange={(event) =>
            handleChange(
              'branchName',
              event.target.value
            )
          }

          placeholder="Enter branch name"

          required

          disabled={saving}

        />

      </div>


      {/* ====================================================
          LOCATION
      ===================================================== */}

      <div className="flex flex-col gap-1.5">

        <label
          className="
            text-sm
            font-medium
            text-navy-700
          "
        >

          Location

        </label>

        <input

          type="text"

          className="input-field"

          value={form.location}

          onChange={(event) =>
            handleChange(
              'location',
              event.target.value
            )
          }

          placeholder="Enter branch location"

          required

          disabled={saving}

        />

      </div>


      {/* ====================================================
          ACTIONS
      ===================================================== */}

      <div
        className="
          flex
          justify-end
          gap-3
          pt-2
        "
      >

        <button

          type="button"

          onClick={onCancel}

          className="btn-secondary"

          disabled={saving}

        >

          Cancel

        </button>


        <button

          type="submit"

          className="btn-primary"

          disabled={saving}

        >

          {saving
            ? 'Saving...'
            : editing
              ? 'Update Branch'
              : 'Add Branch'
          }

        </button>

      </div>

    </form>

  );

}