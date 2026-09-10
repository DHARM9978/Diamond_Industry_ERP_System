import { useState, useEffect } from 'react';

import {
  Plus,
  Pencil,
  Users,
  Phone,
  Mail,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import {
  employeeService,
  branchService,
  departmentService,
} from '@/services/apiServices';


// ============================================================
// Helpers
// ============================================================

const getEmployeeName = (employee) => {
  const firstName = employee?.firstName || '';
  const lastName = employee?.lastName || '';

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || '—';
};


const getDepartmentName = (employee) => {
  if (
    employee?.department &&
    typeof employee.department === 'object'
  ) {
    return (
      employee.department.departmentName ||
      employee.department.name ||
      '—'
    );
  }

  return employee?.department || '—';
};


const getBranchName = (employee) => {
  if (
    employee?.branch &&
    typeof employee.branch === 'object'
  ) {
    return (
      employee.branch.branchName ||
      employee.branch.name ||
      '—'
    );
  }

  return employee?.branch || '—';
};


const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Something went wrong while saving the employee.'
  );
};


const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '₹0.00';
  }

  return `₹${number.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};


const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0.00';
  }

  return number.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


// ============================================================
// Main Component
// ============================================================

export function AdminEmployees() {
  const { toast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);


  // ==========================================================
  // Load Employees / Branches / Departments
  // ==========================================================

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        employeesResponse,
        branchesResponse,
        departmentsResponse,
      ] = await Promise.all([
        employeeService.list(),
        branchService.list(),
        departmentService.list(),
      ]);

      console.log(
        'Employees API response:',
        employeesResponse
      );

      console.log(
        'Branches API response:',
        branchesResponse
      );

      console.log(
        'Departments API response:',
        departmentsResponse
      );

      const employeeData = Array.isArray(
        employeesResponse
      )
        ? employeesResponse
        : [];

      const branchData = Array.isArray(
        branchesResponse
      )
        ? branchesResponse
        : [];

      const departmentData = Array.isArray(
        departmentsResponse
      )
        ? departmentsResponse
        : [];

      setEmployees(employeeData);
      setBranches(branchData);
      setDepartments(departmentData);

    } catch (error) {
      console.error(
        'Failed to load employee data:',
        error
      );

      toast(
        getErrorMessage(error),
        'error'
      );

    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, []);


  // ==========================================================
  // Filter Employees
  // ==========================================================

  const filtered = employees.filter(
    (employee) => {
      const employeeName =
        getEmployeeName(employee);

      const employeeEmail =
        employee?.email || '';

      const employeeId =
        employee?.employeeId || '';

      const searchText =
        search.toLowerCase().trim();

      const matchSearch =
        !searchText ||
        employeeName
          .toLowerCase()
          .includes(searchText) ||
        employeeEmail
          .toLowerCase()
          .includes(searchText) ||
        String(employeeId)
          .toLowerCase()
          .includes(searchText);

      const matchStatus =
        !statusFilter ||
        employee?.status === statusFilter;

      return (
        matchSearch &&
        matchStatus
      );
    }
  );


  // ==========================================================
  // Table Columns
  // ==========================================================

  const columns = [

    // --------------------------------------------------------
    // Employee ID
    // --------------------------------------------------------

    {
      key: 'employeeId',

      label: 'Emp ID',

      render: (employee) => (
        <span
          className="
            font-mono
            text-xs
            font-semibold
            text-navy-600
          "
        >
          {employee?.employeeId ?? '—'}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Employee Name
    // --------------------------------------------------------

    {
      key: 'name',

      label: 'Name',

      render: (employee) => {
        const name =
          getEmployeeName(employee);

        const initial =
          employee?.firstName
            ?.charAt(0)
            ?.toUpperCase() || 'E';

        return (
          <div className="flex items-center gap-3">

            <div
              className="
                w-9
                h-9
                rounded-full
                bg-navy-100
                flex
                items-center
                justify-center
                shrink-0
              "
            >
              <span
                className="
                  text-sm
                  font-semibold
                  text-navy-700
                "
              >
                {initial}
              </span>
            </div>

            <div>
              <p className="font-medium text-navy-900">
                {name}
              </p>

              <p className="text-xs text-navy-400">
                {employee?.role || 'EMPLOYEE'}
              </p>
            </div>

          </div>
        );
      },
    },


    // --------------------------------------------------------
    // Department
    // --------------------------------------------------------

    {
      key: 'department',

      label: 'Department',

      render: (employee) => (
        <span className="text-navy-600">
          {getDepartmentName(employee)}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Branch
    // --------------------------------------------------------

    {
      key: 'branch',

      label: 'Branch',

      render: (employee) => (
        <span className="text-navy-600">
          {getBranchName(employee)}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Contact
    // --------------------------------------------------------

    {
      key: 'contact',

      label: 'Contact',

      render: (employee) => (
        <div className="text-xs">

          <p
            className="
              flex
              items-center
              gap-1
              text-navy-600
            "
          >
            <Phone size={12} />
            {employee?.phone || '—'}
          </p>

          <p
            className="
              flex
              items-center
              gap-1
              text-navy-400
            "
          >
            <Mail size={12} />
            {employee?.email || '—'}
          </p>

        </div>
      ),
    },


    // --------------------------------------------------------
    // Base Salary
    // --------------------------------------------------------

    {
      key: 'baseSalary',

      label: 'Base Salary',

      align: 'right',

      render: (employee) => (
        <span className="font-semibold text-navy-800">

          {formatCurrency(
            employee?.baseSalary
          )}

          <span className="text-xs text-navy-400 ml-1">
            /mo
          </span>

        </span>
      ),
    },


    // --------------------------------------------------------
    // Expected Monthly Hours
    // --------------------------------------------------------

    {
      key: 'monthlyExpectedHours',

      label: 'Expected Hours',

      align: 'right',

      render: (employee) => (
        <span className="text-navy-700">

          {formatNumber(
            employee?.monthlyExpectedHours
          )}

          <span className="text-xs text-navy-400 ml-1">
            hrs/mo
          </span>

        </span>
      ),
    },


    // --------------------------------------------------------
    // Calculated Hourly Rate
    // --------------------------------------------------------

    {
      key: 'salaryRatePerHour',

      label: 'Hourly Rate',

      align: 'right',

      render: (employee) => (
        <span className="font-semibold text-navy-800">

          {formatCurrency(
            employee?.salaryRatePerHour
          )}

          <span className="text-xs text-navy-400 ml-1">
            /hr
          </span>

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

      render: (employee) => (
        <StatusBadge
          status={employee?.status}
        />
      ),
    },


    // --------------------------------------------------------
    // Edit
    // --------------------------------------------------------

    {
      key: 'actions',

      label: '',

      align: 'right',

      render: (employee) => (
        <button
          type="button"

          onClick={() => {
            setEditing(employee);
            setModalOpen(true);
          }}

          className="
            p-2
            rounded-lg
            text-navy-400
            hover:bg-navy-100
            hover:text-navy-700
            transition-colors
          "
        >
          <Pencil size={16} />
        </button>
      ),
    },

  ];


  // ==========================================================
  // Save Employee
  // ==========================================================

  const handleSave = async (formData) => {
    try {
      setSaving(true);

      console.log(
        'Employee payload being sent to backend:',
        formData
      );

      let response;

      // ------------------------------------------------------
      // UPDATE
      // ------------------------------------------------------

      if (editing) {
        response =
          await employeeService.update(
            editing.employeeId,
            formData
          );

        console.log(
          'Employee update response:',
          response
        );

        toast(
          'Employee updated successfully',
          'success'
        );

      }

      // ------------------------------------------------------
      // CREATE
      // ------------------------------------------------------

      else {
        response =
          await employeeService.create(
            formData
          );

        console.log(
          'Employee create response:',
          response
        );

        toast(
          'Employee added successfully',
          'success'
        );
      }


      // ------------------------------------------------------
      // Close modal
      // ------------------------------------------------------

      setModalOpen(false);
      setEditing(null);


      // ------------------------------------------------------
      // Reload actual backend data
      // ------------------------------------------------------

      await loadData();

    } catch (error) {
      console.error(
        'Employee save failed:',
        error
      );

      toast(
        getErrorMessage(error),
        'error'
      );

    } finally {
      setSaving(false);
    }
  };


  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading employees..."
      />
    );
  }


  // ==========================================================
  // Render
  // ==========================================================

  return (
    <div>

      {/* ======================================================
          Header
      ====================================================== */}

      <PageHeader
        title="Employees"

        subtitle={`
          ${filtered.length}
          employee${filtered.length !== 1 ? 's' : ''}
          total
        `}

        actions={
          <button
            type="button"

            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}

            className="
              btn-primary
              flex
              items-center
              gap-2
            "
          >
            <Plus size={18} />
            Add Employee
          </button>
        }
      />


      {/* ======================================================
          Filters
      ====================================================== */}

      <div
        className="
          flex
          flex-col
          sm:flex-row
          gap-3
          mb-5
        "
      >

        <div className="flex-1">

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, email, or ID..."
          />

        </div>


        <div className="sm:w-48">

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Statuses"

            options={[
              {
                value: 'ACTIVE',
                label: 'Active',
              },
              {
                value: 'INACTIVE',
                label: 'Inactive',
              },
              {
                value: 'SUSPENDED',
                label: 'Suspended',
              },
              {
                value: 'TERMINATED',
                label: 'Terminated',
              },
            ]}
          />

        </div>

      </div>


      {/* ======================================================
          Employee Table
      ====================================================== */}

      {filtered.length === 0 ? (

        <EmptyState
          icon={Users}
          title="No employees found"
          message="
            Try adjusting your search or filters,
            or add a new employee.
          "
        />

      ) : (

        <DataTable
          columns={columns}
          data={filtered}
        />

      )}


      {/* ======================================================
          Employee Modal
      ====================================================== */}

      <EmployeeModal
        open={modalOpen}

        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditing(null);
          }
        }}

        editing={editing}
        branches={branches}
        departments={departments}
        saving={saving}
        onSave={handleSave}
      />

    </div>
  );
}


// =================================================================
// Employee Modal
// =================================================================

function EmployeeModal({
  open,
  onClose,
  editing,
  branches,
  departments,
  saving,
  onSave,
}) {

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    hireDate: '',
    role: 'EMPLOYEE',

    // New salary configuration
    baseSalary: '',
    monthlyExpectedHours: '',

    // Display only.
    // Backend calculates and stores this.
    salaryRatePerHour: '',

    branchId: '',
    departmentId: '',
    managerId: null,
    status: 'ACTIVE',
  });


  // ==========================================================
  // Reset / Load Form
  // ==========================================================

  useEffect(() => {

    if (editing) {

      const hireDate =
        editing?.hireDate
          ? String(
              editing.hireDate
            ).substring(0, 10)
          : '';


      const departmentId =
        editing?.department?.departmentId ??
        editing?.departmentId ??
        '';


      const branchId =
        editing?.branch?.branchId ??
        editing?.branchId ??
        '';


      setForm({
        firstName:
          editing?.firstName || '',

        lastName:
          editing?.lastName || '',

        email:
          editing?.email || '',

        phone:
          editing?.phone || '',

        gender:
          editing?.gender || '',

        hireDate,

        role:
          editing?.role || 'EMPLOYEE',

        baseSalary:
          editing?.baseSalary ?? '',

        monthlyExpectedHours:
          editing?.monthlyExpectedHours ?? '',

        salaryRatePerHour:
          editing?.salaryRatePerHour ?? '',

        branchId:
          branchId
            ? String(branchId)
            : '',

        departmentId:
          departmentId
            ? String(departmentId)
            : '',

        managerId:
          editing?.managerId ?? null,

        status:
          editing?.status || 'ACTIVE',
      });

    } else {

      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: '',
        hireDate: '',
        role: 'EMPLOYEE',

        baseSalary: '',
        monthlyExpectedHours: '',
        salaryRatePerHour: '',

        branchId: '',
        departmentId: '',
        managerId: null,
        status: 'ACTIVE',
      });

    }

  }, [editing, open]);


  // ==========================================================
  // Calculated Hourly Rate
  // ==========================================================

  const baseSalaryNumber =
    Number(form.baseSalary);

  const monthlyHoursNumber =
    Number(form.monthlyExpectedHours);

  const calculatedHourlyRate =
    Number.isFinite(baseSalaryNumber) &&
    baseSalaryNumber > 0 &&
    Number.isFinite(monthlyHoursNumber) &&
    monthlyHoursNumber > 0
      ? (
          baseSalaryNumber /
          monthlyHoursNumber
        ).toFixed(2)
      : '';


  // ==========================================================
  // Update Field
  // ==========================================================

  const updateField = (
    field,
    value
  ) => {

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

  };


  // ==========================================================
  // Submit
  // ==========================================================

  const handleSubmit = async (event) => {

    event.preventDefault();


    // --------------------------------------------------------
    // Basic validation
    // --------------------------------------------------------

    if (!form.firstName.trim()) {
      return;
    }

    if (!form.lastName.trim()) {
      return;
    }

    if (!form.email.trim()) {
      return;
    }

    if (!form.branchId) {
      return;
    }


    // --------------------------------------------------------
    // Salary validation
    // --------------------------------------------------------

    const baseSalary =
      Number(form.baseSalary);

    const monthlyExpectedHours =
      Number(form.monthlyExpectedHours);


    if (
      !Number.isFinite(baseSalary) ||
      baseSalary <= 0
    ) {
      return;
    }


    if (
      !Number.isFinite(monthlyExpectedHours) ||
      monthlyExpectedHours <= 0
    ) {
      return;
    }


    // --------------------------------------------------------
    // Backend payload
    //
    // Notice:
    // salaryRatePerHour is NOT sent.
    //
    // The backend calculates it from:
    //
    // baseSalary / monthlyExpectedHours
    // --------------------------------------------------------

    const payload = {

      firstName:
        form.firstName.trim(),

      lastName:
        form.lastName.trim(),

      email:
        form.email.trim(),

      phone:
        form.phone.trim() || null,

      gender:
        form.gender || null,

      hireDate:
        form.hireDate || null,

      role:
        form.role || 'EMPLOYEE',

      baseSalary,

      monthlyExpectedHours,

      branchId:
        Number(form.branchId),

      departmentId:
        form.departmentId
          ? Number(form.departmentId)
          : null,

      managerId:
        form.managerId
          ? Number(form.managerId)
          : null,

      status:
        form.status || 'ACTIVE',
    };


    console.log(
      'FINAL EMPLOYEE PAYLOAD:',
      payload
    );


    await onSave(payload);
  };


  // ==========================================================
  // Department Options
  // ==========================================================

  const departmentOptions =
    departments
      .map((department) => ({
        value:
          department?.departmentId ??
          department?.id ??
          '',

        label:
          department?.departmentName ??
          department?.name ??
          'Unknown Department',
      }))

      .filter(
        (department) =>
          department.value !== ''
      );


  // ==========================================================
  // Branch Options
  // ==========================================================

  const branchOptions =
    branches
      .map((branch) => ({
        value:
          branch?.branchId ??
          branch?.id ??
          '',

        label:
          branch?.branchName ??
          branch?.name ??
          'Unknown Branch',
      }))

      .filter(
        (branch) =>
          branch.value !== ''
      );


  // ==========================================================
  // Render
  // ==========================================================

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editing
          ? 'Edit Employee'
          : 'Add Employee'
      }
      size="lg"
    >

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >

        {/* ==================================================
            First Name / Last Name
        ================================================== */}

        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-2
            gap-4
          "
        >

          {/* First Name */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              First Name
              <span className="text-error-500">
                *
              </span>
            </label>

            <input
              className="input-field"
              value={form.firstName}

              onChange={(event) =>
                updateField(
                  'firstName',
                  event.target.value
                )
              }

              required
            />

          </div>


          {/* Last Name */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Last Name
              <span className="text-error-500">
                *
              </span>
            </label>

            <input
              className="input-field"
              value={form.lastName}

              onChange={(event) =>
                updateField(
                  'lastName',
                  event.target.value
                )
              }

              required
            />

          </div>


          {/* Email */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Email
              <span className="text-error-500">
                *
              </span>
            </label>

            <input
              type="email"
              className="input-field"
              value={form.email}

              onChange={(event) =>
                updateField(
                  'email',
                  event.target.value
                )
              }

              required
            />

          </div>


          {/* Phone */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Phone
            </label>

            <input
              type="tel"
              className="input-field"
              value={form.phone}

              onChange={(event) =>
                updateField(
                  'phone',
                  event.target.value
                )
              }
            />

          </div>


          {/* Gender */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Gender
            </label>

            <select
              className="input-field"
              value={form.gender}

              onChange={(event) =>
                updateField(
                  'gender',
                  event.target.value
                )
              }
            >

              <option value="">
                Select Gender
              </option>

              <option value="Male">
                Male
              </option>

              <option value="Female">
                Female
              </option>

              <option value="Other">
                Other
              </option>

            </select>

          </div>


          {/* Hire Date */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Hire Date
            </label>

            <input
              type="date"
              className="input-field"
              value={form.hireDate}

              onChange={(event) =>
                updateField(
                  'hireDate',
                  event.target.value
                )
              }
            />

          </div>


          {/* Department */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Department
            </label>

            <select
              className="input-field"
              value={form.departmentId}

              onChange={(event) =>
                updateField(
                  'departmentId',
                  event.target.value
                )
              }
            >

              <option value="">
                Select Department
              </option>

              {departmentOptions.map(
                (department) => (
                  <option
                    key={department.value}
                    value={department.value}
                  >
                    {department.label}
                  </option>
                )
              )}

            </select>

          </div>


          {/* Branch */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Branch
              <span className="text-error-500">
                *
              </span>
            </label>

            <select
              className="input-field"
              value={form.branchId}

              onChange={(event) =>
                updateField(
                  'branchId',
                  event.target.value
                )
              }

              required
            >

              <option value="">
                Select Branch
              </option>

              {branchOptions.map(
                (branch) => (
                  <option
                    key={branch.value}
                    value={branch.value}
                  >
                    {branch.label}
                  </option>
                )
              )}

            </select>

          </div>


          {/* ==================================================
              Base Salary
          ================================================== */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Base Salary / Month

              <span className="text-error-500">
                *
              </span>
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"

              className="input-field"

              value={form.baseSalary}

              onChange={(event) =>
                updateField(
                  'baseSalary',
                  event.target.value
                )
              }

              placeholder="e.g. 30000"

              required
            />

            <p className="text-xs text-navy-400">
              Monthly salary before attendance-based calculation.
            </p>

          </div>


          {/* ==================================================
              Expected Monthly Hours
          ================================================== */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Expected Hours / Month

              <span className="text-error-500">
                *
              </span>
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"

              className="input-field"

              value={form.monthlyExpectedHours}

              onChange={(event) =>
                updateField(
                  'monthlyExpectedHours',
                  event.target.value
                )
              }

              placeholder="e.g. 208"

              required
            />

            <p className="text-xs text-navy-400">
              Expected working hours for one month.
            </p>

          </div>


          {/* ==================================================
              Calculated Hourly Rate
          ================================================== */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Calculated Hourly Rate
            </label>

            <div
              className="
                input-field
                bg-navy-50
                text-navy-700
                font-semibold
                flex
                items-center
              "
            >

              {calculatedHourlyRate
                ? `${formatCurrency(
                    calculatedHourlyRate
                  )} / hour`
                : 'Enter salary and expected hours'}

            </div>

            <p className="text-xs text-navy-400">
              Base salary ÷ expected monthly hours.
            </p>

          </div>


          {/* Role */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Role
            </label>

            <select
              className="input-field"
              value={form.role}

              onChange={(event) =>
                updateField(
                  'role',
                  event.target.value
                )
              }
            >

              <option value="EMPLOYEE">
                Employee
              </option>

              <option value="MANAGER">
                Manager
              </option>

            </select>

          </div>


          {/* Status */}

          <div className="flex flex-col gap-1.5">

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Status
            </label>

            <select
              className="input-field"
              value={form.status}

              onChange={(event) =>
                updateField(
                  'status',
                  event.target.value
                )
              }
            >

              <option value="ACTIVE">
                Active
              </option>

              <option value="INACTIVE">
                Inactive
              </option>

              <option value="SUSPENDED">
                Suspended
              </option>

              <option value="TERMINATED">
                Terminated
              </option>

            </select>

          </div>

        </div>


        {/* ==================================================
            Salary Information
        ================================================== */}

        <div
          className="
            rounded-lg
            bg-navy-50
            border
            border-navy-100
            p-3
            text-sm
            text-navy-600
          "
        >

          <p>
            <strong>Salary calculation:</strong>{' '}
            Base Salary ÷ Expected Monthly Hours =
            Hourly Rate.
          </p>

          <p className="mt-1">
            The hourly rate is calculated by the backend
            and used for attendance-based payroll.
          </p>

        </div>


        {/* ==================================================
            Employee Login Information
        ================================================== */}

        {!editing && (

          <div
            className="
              rounded-lg
              bg-navy-50
              border
              border-navy-100
              p-3
              text-sm
              text-navy-600
            "
          >

            <strong>
              Employee login:
            </strong>{' '}

            The backend will automatically
            generate the initial employee
            password.

          </div>

        )}


        {/* ==================================================
            Buttons
        ================================================== */}

        <div
          className="
            flex
            justify-end
            gap-3
            pt-4
            border-t
            border-navy-100
          "
        >

          <button
            type="button"
            onClick={onClose}
            disabled={saving}

            className="
              px-4
              py-2
              rounded-lg
              text-sm
              font-medium
              text-navy-600
              hover:bg-navy-100
              disabled:opacity-50
            "
          >
            Cancel
          </button>


          <button
            type="submit"
            disabled={saving}

            className="
              btn-primary
              px-5
              py-2
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >

            {saving
              ? 'Saving...'
              : editing
                ? 'Update Employee'
                : 'Add Employee'}

          </button>

        </div>

      </form>

    </Modal>
  );
}