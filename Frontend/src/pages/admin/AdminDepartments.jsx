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

import {
  departmentService,
  branchService,
  employeeService,
} from '@/services/apiServices';


export function AdminDepartments() {

  const { toast } = useToast();

  // ============================================================
  // STATE
  // ============================================================

  const [departments, setDepartments] = useState([]);

  const [branches, setBranches] = useState([]);

  const [selectedBranch, setSelectedBranch] = useState('');

  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState(null);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');


  // ============================================================
  // LOAD DEPARTMENTS
  // ============================================================

  const loadDepartments = async (branchId = selectedBranch) => {

    if (!branchId) {
      setDepartments([]);
      setLoading(false);
      return;
    }

    try {

      setLoading(true);
      setError('');

      const response = await departmentService.list({
        branchId: Number(branchId)
      });

      console.log(
        'Departments API response:',
        response
      );

      /*
       * Expected response after apiServices unwrap():
       *
       * [
       *   {
       *     departmentId: 1,
       *     departmentName: "Information Technology",
       *     branchId: 1,
       *     companyId: 1,
       *     managerId: null,
       *     branch: {
       *       branchId: 1,
       *       branchName: "Main Branch",
       *       location: "Bangalore"
       *     },
       *     manager: null
       *   }
       * ]
       */

      const data =
        Array.isArray(response)
          ? response
          : response?.data || [];

      setDepartments(data);

    } catch (err) {

      console.error(
        'Failed to load departments:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load departments';

      setError(message);

      toast(
        message,
        'error'
      );

    } finally {

      setLoading(false);

    }

  };


  // ============================================================
  // LOAD BRANCHES
  // ============================================================

  const loadBranches = async () => {

    try {

      const response = await branchService.list();

      console.log(
        'Branches API response:',
        response
      );

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

      toast(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load branches',
        'error'
      );

    }

  };


  // ============================================================
  // LOAD EMPLOYEES
  // ============================================================

  const loadEmployees = async () => {

    try {

      const response = await employeeService.list();

      console.log(
        'Employees API response:',
        response
      );

      const data =
        Array.isArray(response)
          ? response
          : response?.data || [];

      setEmployees(data);

    } catch (err) {

      console.error(
        'Failed to load employees:',
        err
      );

      /*
       * Manager is optional, so failure to load employees
       * should not prevent the department page from loading.
       */

      setEmployees([]);

    }

  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {

    const loadPage = async () => {

      await Promise.all([
        loadBranches(),
        loadEmployees(),
      ]);

      setLoading(false);

    };

    loadPage();

  }, []);


  // ============================================================
  // BRANCH SELECTION
  // ============================================================

  useEffect(() => {

    if (!selectedBranch) {
      setDepartments([]);
      setLoading(false);
      return;
    }

    loadDepartments(selectedBranch);

  }, [selectedBranch]);


  // ============================================================
  // SELECTED BRANCH
  // ============================================================

  const selectedBranchData =
    branches.find(
      (branch) =>
        Number(branch.branchId) ===
        Number(selectedBranch)
    ) || null;


  // ============================================================
  // ADD DEPARTMENT
  // ============================================================

  const handleAdd = () => {

    if (!selectedBranch) {
      toast('Please select a branch first', 'error');
      return;
    }

    setEditing(null);

    setModalOpen(true);

  };


  // ============================================================
  // EDIT DEPARTMENT
  // ============================================================

  const handleEdit = (department) => {

    setEditing(department);

    setModalOpen(true);

  };


  // ============================================================
  // DELETE DEPARTMENT
  // ============================================================

  const handleDelete = async (department) => {

    const confirmed = window.confirm(
      `Are you sure you want to delete "${department.departmentName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {

      setSaving(true);

      await departmentService.delete(
        department.departmentId
      );

      toast(
        'Department deleted successfully',
        'success'
      );

      // IMPORTANT:
      // Reload actual database data.
      await loadDepartments(selectedBranch);

    } catch (err) {

      console.error(
        'Failed to delete department:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete department';

      toast(
        message,
        'error'
      );

    } finally {

      setSaving(false);

    }

  };


  // ============================================================
  // SAVE DEPARTMENT
  // ============================================================

  const handleSave = async (formData) => {

    try {

      setSaving(true);

      /*
       * Backend expects actual database fields:
       *
       * departmentName
       * branchId
       * managerId
       *
       * Do NOT send:
       *
       * name
       * branch
       * head
       *
       * because those were frontend/mock fields.
       */

      const payload = {

        departmentName:
          formData.departmentName.trim(),

        branchId:
          Number(selectedBranch),

        managerId:
          formData.managerId
            ? Number(formData.managerId)
            : null,

      };


      // ========================================================
      // UPDATE
      // ========================================================

      if (editing) {

        await departmentService.update(
          editing.departmentId,
          payload
        );

        toast(
          'Department updated successfully',
          'success'
        );

      }


      // ========================================================
      // CREATE
      // ========================================================

      else {

        await departmentService.create(
          payload
        );

        toast(
          'Department added successfully',
          'success'
        );

      }


      // ========================================================
      // RELOAD DATABASE DATA
      // ========================================================

      await loadDepartments(selectedBranch);

      setModalOpen(false);

      setEditing(null);

    } catch (err) {

      console.error(
        'Failed to save department:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save department';

      toast(
        message,
        'error'
      );

    } finally {

      setSaving(false);

    }

  };


  // ============================================================
  // TABLE COLUMNS
  // ============================================================

  const columns = [

    // ----------------------------------------------------------
    // Department
    // ----------------------------------------------------------

    {
      key: 'departmentName',

      label: 'Department',

      render: (department) => (

        <span className="font-medium text-navy-900">

          {department?.departmentName || '—'}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // Branch
    // ----------------------------------------------------------

    {
      key: 'branch',

      label: 'Branch',

      render: (department) => (

        <span className="text-sm text-navy-600">

          {department?.branch?.branchName || '—'}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // Company ID
    // ----------------------------------------------------------

    {
      key: 'companyId',

      label: 'Company ID',

      align: 'center',

      render: (department) => (

        <span className="font-semibold text-navy-700">

          {department?.companyId ?? '—'}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // Department Manager
    // ----------------------------------------------------------

    {
      key: 'manager',

      label: 'Manager',

      render: (department) => {

        const manager =
          department?.manager;

        if (!manager) {

          return (

            <span className="text-sm text-navy-400">

              Not assigned

            </span>

          );

        }


        /*
         * Handle possible employee response structures.
         */

        const firstName =
          manager?.firstName || '';

        const lastName =
          manager?.lastName || '';

        const fullName =
          `${firstName} ${lastName}`.trim();


        return (

          <span className="text-sm text-navy-600">

            {
              fullName ||
              manager?.name ||
              manager?.employeeName ||
              '—'
            }

          </span>

        );

      },

    },


    // ----------------------------------------------------------
    // Created Date
    // ----------------------------------------------------------

    {
      key: 'createdAt',

      label: 'Created',

      render: (department) => {

        if (!department?.createdAt) {

          return (

            <span className="text-sm text-navy-400">

              —

            </span>

          );

        }


        const date =
          new Date(
            department.createdAt
          );


        return (

          <span className="text-sm text-navy-600">

            {date.toLocaleDateString()}

          </span>

        );

      },

    },


    // ----------------------------------------------------------
    // Actions
    // ----------------------------------------------------------

    {
      key: 'actions',

      label: '',

      align: 'right',

      render: (department) => (

        <div className="flex items-center justify-end gap-1">

          {/* EDIT */}

          <button
            type="button"
            onClick={() =>
              handleEdit(department)
            }
            className="
              p-2
              rounded-lg
              text-navy-400
              hover:bg-navy-100
              hover:text-navy-700
              transition-colors
            "
            title="Edit department"
          >

            <Pencil size={16} />

          </button>


          {/* DELETE */}

          <button
            type="button"
            onClick={() =>
              handleDelete(department)
            }
            className="
              p-2
              rounded-lg
              text-red-400
              hover:bg-red-50
              hover:text-red-600
              transition-colors
            "
            title="Delete department"
          >

            <Trash2 size={16} />

          </button>

        </div>

      ),

    },

  ];


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (

      <FullPageSpinner
        message="Loading departments..."
      />

    );

  }


  // ============================================================
  // PAGE
  // ============================================================

  return (

    <div>

      {/* ========================================================
          PAGE HEADER
      ========================================================= */}

      <PageHeader

        title="Departments"

        subtitle={
          selectedBranch
            ? `${departments.length} department${
                departments.length !== 1
                  ? 's'
                  : ''
              }`
            : 'Select a branch to manage departments'
        }

        actions={

          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedBranch || saving}
            className="
              btn-primary
              flex
              items-center
              gap-2
            "
          >

            <Plus size={18} />

            Add Department

          </button>

        }

      />


      {/* ========================================================
          ERROR
      ========================================================= */}

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


      {/* ========================================================
          BRANCH SELECTION
      ========================================================= */}

      <div className="mb-6 rounded-xl border border-navy-200 bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-1.5">

          <label className="text-sm font-medium text-navy-700">
            Select Branch
          </label>

          <select
            className="input-field max-w-xl"
            value={selectedBranch}
            onChange={(event) => {
              setSelectedBranch(event.target.value);
              setModalOpen(false);
              setEditing(null);
            }}
          >
            <option value="">
              Select a branch to view departments
            </option>

            {branches.map((branch) => (
              <option
                key={branch.branchId}
                value={branch.branchId}
              >
                {branch.branchName}
                {branch.location
                  ? ` — ${branch.location}`
                  : ''}
              </option>
            ))}
          </select>

        </div>

        {selectedBranchData && (
          <div className="mt-3 text-sm text-navy-500">
            Showing departments for
            <span className="ml-1 font-semibold text-navy-700">
              {selectedBranchData.branchName}
            </span>
          </div>
        )}

      </div>


      {/* ========================================================
          DEPARTMENT TABLE
      ========================================================= */}

      {!selectedBranch ? (

        <EmptyState

          icon={Network}

          title="Select a branch"

          message="Select a branch above to view and manage its departments."

        />

      ) : departments.length === 0 ? (

        <EmptyState

          icon={Network}

          title="No departments"

          message="This branch has no departments yet. Add a department to get started."

        />

      ) : (

        <DataTable

          columns={columns}

          data={departments}

        />

      )}


      {/* ========================================================
          ADD / EDIT MODAL
      ========================================================= */}

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
            ? 'Edit Department'
            : 'Add Department'
        }

      >

        <DeptForm

          editing={editing}

          selectedBranch={selectedBranchData}

          employees={employees}

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


// =================================================================
// DEPARTMENT FORM
// =================================================================

function DeptForm({
  editing,
  selectedBranch,
  employees,
  saving,
  onCancel,
  onSave,
}) {

  const [form, setForm] = useState({

    departmentName:
      editing?.departmentName || '',

    branchId:
      editing?.branchId
        ? String(editing.branchId)
        : selectedBranch?.branchId
          ? String(selectedBranch.branchId)
          : '',

    managerId:
      editing?.managerId
        ? String(editing.managerId)
        : '',

  });


  // ============================================================
  // RESET FORM WHEN EDITING CHANGES
  // ============================================================

  useEffect(() => {

    if (!editing) {

      setForm({

        departmentName: '',

        branchId:
          selectedBranch?.branchId
            ? String(selectedBranch.branchId)
            : '',

        managerId: '',

      });

      return;

    }


    setForm({

      departmentName:
        editing?.departmentName || '',

      branchId:
        editing?.branchId
          ? String(editing.branchId)
          : selectedBranch?.branchId
            ? String(selectedBranch.branchId)
            : '',

      managerId:
        editing?.managerId
          ? String(editing.managerId)
          : '',

    });

  }, [editing, selectedBranch]);


  // ============================================================
  // HANDLE CHANGE
  // ============================================================

  const handleChange = (
    field,
    value
  ) => {

    setForm((previous) => ({

      ...previous,

      [field]: value,

    }));

  };


  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = (event) => {

    event.preventDefault();


    if (!form.departmentName.trim()) {

      return;

    }


    if (!form.branchId) {

      return;

    }


    onSave(form);

  };


  // ============================================================
  // FILTER MANAGERS BY SELECTED BRANCH
  // ============================================================

  const branchEmployees = employees.filter(
    (employee) =>
      Number(employee?.branchId) ===
      Number(form.branchId)
  );


  // ============================================================
  // RENDER
  // ============================================================

  return (

    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >

      {/* ======================================================
          DEPARTMENT NAME
      ======================================================= */}

      <div className="flex flex-col gap-1.5">

        <label
          className="
            text-sm
            font-medium
            text-navy-700
          "
        >

          Department Name

        </label>


        <input

          type="text"

          className="input-field"

          value={form.departmentName}

          onChange={(event) =>
            handleChange(
              'departmentName',
              event.target.value
            )
          }

          placeholder="Enter department name"

          required

          disabled={saving}

        />

      </div>


      {/* ======================================================
          BRANCH
      ======================================================= */}

      <div className="flex flex-col gap-1.5">

        <label
          className="
            text-sm
            font-medium
            text-navy-700
          "
        >

          Branch

        </label>

        <div className="input-field bg-navy-50 text-navy-700">

          {selectedBranch?.branchName || 'Selected branch'}

          {selectedBranch?.location
            ? ` — ${selectedBranch.location}`
            : ''}

        </div>

        <p className="text-xs text-navy-400">
          The department will be created under the selected branch.
        </p>

      </div>


      {/* ======================================================
          DEPARTMENT MANAGER
      ======================================================= */}

      <div className="flex flex-col gap-1.5">

        <label
          className="
            text-sm
            font-medium
            text-navy-700
          "
        >

          Department Manager

        </label>


        <select

          className="input-field"

          value={form.managerId}

          onChange={(event) =>
            handleChange(
              'managerId',
              event.target.value
            )
          }

          disabled={saving}

        >

          <option value="">

            No Manager

          </option>


          {branchEmployees.map((employee) => {

            const fullName =
              `${employee?.firstName || ''} ${
                employee?.lastName || ''
              }`.trim();


            return (

              <option
                key={employee.employeeId}
                value={employee.employeeId}
              >

                {
                  fullName ||
                  employee?.name ||
                  employee?.employeeName ||
                  `Employee #${employee.employeeId}`
                }

              </option>

            );

          })}

        </select>

      </div>


      {/* ======================================================
          BUTTONS
      ======================================================= */}

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

          disabled={
            saving ||
            !form.departmentName.trim() ||
            !form.branchId
          }

        >

          {saving
            ? 'Saving...'
            : editing
              ? 'Update Department'
              : 'Add Department'
          }

        </button>

      </div>

    </form>

  );

}