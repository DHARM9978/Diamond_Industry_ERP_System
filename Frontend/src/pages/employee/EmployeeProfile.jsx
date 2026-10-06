import { useState, useEffect } from 'react';

import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  BadgeCheck,
  Wallet,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import { selfService } from '@/services/apiServices';

import { formatISTDate } from '@/utils/dateTime';


// ============================================================
// Helpers
// ============================================================

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


const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const formatted = formatISTDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return formatted === '—'
    ? String(value)
    : formatted;
};


const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;


// ============================================================
// Password Input
// ============================================================

const PasswordInput = ({
  id,
  label,
  value,
  onChange,
  showPassword,
  onToggle,
  disabled = false,
  autoComplete,
}) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={id}
      className="text-sm font-medium text-navy-700"
    >
      {label}
    </label>

    <div className="relative">
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        className="input-field w-full pr-11"
      />

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 transition-colors hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);


// ============================================================
// Main Component
// ============================================================

export function EmployeeProfile() {
  const { toast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  // ============================================================
  // Load Employee Profile
  // ============================================================

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const res =
          await selfService.profile();

        console.log(
          'Employee Profile:',
          res
        );

        if (!isMounted) {
          return;
        }

        setProfile(res);

      } catch (error) {
        console.error(
          'Failed to load employee profile:',
          error
        );

        if (!isMounted) {
          return;
        }

        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load your profile';

        setError(message);
        setProfile(null);

      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);


  // ============================================================
  // Password Change
  // ============================================================

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };


  const openPasswordModal = () => {
    resetPasswordForm();
    setPasswordModalOpen(true);
  };


  const closePasswordModal = () => {
    if (passwordSaving) return;
    setPasswordModalOpen(false);
    resetPasswordForm();
  };


  const updatePasswordField = (field, value) => {
    setPasswordForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };


  const handleChangePassword = async (event) => {
    event.preventDefault();

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = passwordForm;

    if (!currentPassword) {
      toast('Enter your current password.', 'error');
      return;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast(`New password must be at least ${PASSWORD_MIN_LENGTH} characters long.`, 'error');
      return;
    }

    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      toast(`New password must not exceed ${PASSWORD_MAX_LENGTH} characters.`, 'error');
      return;
    }

    if (newPassword === currentPassword) {
      toast('New password must be different from the current password.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast('New password and confirm password do not match.', 'error');
      return;
    }

    try {
      setPasswordSaving(true);

      await selfService.changePassword({
        currentPassword,
        newPassword,
      });

      toast('Password changed successfully. Use the new password the next time you log in.', 'success');
      setPasswordModalOpen(false);
      resetPasswordForm();
    } catch (passwordError) {
      console.error('Failed to change employee password:', passwordError);
      toast(
        passwordError?.response?.data?.message ||
          passwordError?.message ||
          'Failed to change password.',
        'error'
      );
    } finally {
      setPasswordSaving(false);
    }
  };


  // ============================================================
  // Loading
  // ============================================================

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading your profile..."
      />
    );
  }


  // ============================================================
  // Error / No Profile
  // ============================================================

  if (!profile) {
    return (
      <div>
        <PageHeader
          title="My Profile"
          subtitle="Your personal and employment information"
        />

        <div
          className="
            rounded-xl
            border
            border-red-200
            bg-red-50
            px-5
            py-4
            text-sm
            text-red-700
          "
        >
          {error || 'Employee profile not found.'}
        </div>
      </div>
    );
  }


  // ============================================================
  // Profile Data
  // ============================================================

  const p = profile;


  // ============================================================
  // Employee Name
  // ============================================================

  const firstName =
    p?.firstName ||
    p?.first_name ||
    '';

  const lastName =
    p?.lastName ||
    p?.last_name ||
    '';

  const fullName =
    `${firstName} ${lastName}`.trim();

  const employeeName =
    p?.name ||
    fullName ||
    'Employee';


  // ============================================================
  // Employee ID
  // ============================================================

  const employeeId =
    p?.employeeId ||
    p?.employee_id ||
    '—';


  // ============================================================
  // Department
  // ============================================================

  const department =
    typeof p?.department === 'object'
      ? (
          p.department?.departmentName ||
          p.department?.name ||
          '—'
        )
      : (
          p?.department ||
          '—'
        );


  // ============================================================
  // Branch
  // ============================================================

  const branch =
    typeof p?.branch === 'object'
      ? (
          p.branch?.branchName ||
          p.branch?.name ||
          '—'
        )
      : (
          p?.branch ||
          '—'
        );


  // ============================================================
  // Other Profile Fields
  // ============================================================

  const email =
    p?.email ||
    '—';

  const phone =
    p?.phone ||
    p?.phoneNumber ||
    p?.phone_number ||
    '—';

  const designation =
    p?.designation ||
    p?.jobTitle ||
    p?.job_title ||
    p?.role ||
    '—';

  const joinDate =
    p?.hireDate ||
    p?.joinDate ||
    p?.join_date ||
    null;

  const status =
    p?.status ||
    '—';


  // ============================================================
  // Salary Information
  // ============================================================

  const baseSalary =
    p?.baseSalary ??
    null;

  const monthlyExpectedHours =
    p?.monthlyExpectedHours ??
    null;

  const salaryRatePerHour =
    p?.salaryRatePerHour ??
    null;


  // ============================================================
  // Tenure
  // ============================================================

  const tenure =
    joinDate
      ? `Since ${
          new Date(joinDate).getFullYear()
        }`
      : '—';


  // ============================================================
  // Employee Initial
  // ============================================================

  const employeeInitial =
    employeeName
      ?.charAt(0)
      ?.toUpperCase() || 'E';


  // ============================================================
  // Profile Fields
  // ============================================================

  const fields = [
    {
      icon: User,
      label: 'Employee ID',
      value: employeeId,
    },

    {
      icon: Mail,
      label: 'Email',
      value: email,
    },

    {
      icon: Phone,
      label: 'Phone',
      value: phone,
    },

    {
      icon: Briefcase,
      label: 'Designation',
      value: designation,
    },

    {
      icon: Building2,
      label: 'Department',
      value: department,
    },

    {
      icon: Building2,
      label: 'Branch',
      value: branch,
    },

    {
      icon: Calendar,
      label: 'Join Date',
      value: formatDate(joinDate),
    },

    {
      icon: BadgeCheck,
      label: 'Status',
      value: (
        <StatusBadge
          status={status}
        />
      ),
    },
  ];


  // ============================================================
  // Render
  // ============================================================

  return (
    <div>

      {/* ======================================================
          Page Header
      ====================================================== */}

      <PageHeader
        title="My Profile"
        subtitle="Your personal and employment information"
      />


      {/* ======================================================
          Summary Cards
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-4
          gap-4
          mb-6
        "
      >

        <StatCard
          icon={Briefcase}
          label="Designation"
          value={designation}
          color="navy"
        />


        <StatCard
          icon={Building2}
          label="Department"
          value={department}
          color="accent"
        />


        <StatCard
          icon={Building2}
          label="Branch"
          value={branch}
          color="success"
        />


        <StatCard
          icon={Calendar}
          label="Tenure"
          value={tenure}
          color="warning"
        />

      </div>


      {/* ======================================================
          Salary Summary
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          gap-4
          mb-6
        "
      >

        <StatCard
          icon={Wallet}
          label="Base Salary"
          value={
            baseSalary !== null
              ? formatCurrency(baseSalary)
              : 'Not configured'
          }
          color="navy"
        />


        <StatCard
          icon={Calendar}
          label="Expected Hours / Month"
          value={
            monthlyExpectedHours !== null
              ? formatNumber(
                  monthlyExpectedHours
                )
              : 'Not configured'
          }
          color="accent"
        />


        <StatCard
          icon={Wallet}
          label="Hourly Rate"
          value={
            salaryRatePerHour !== null
              ? formatCurrency(
                  salaryRatePerHour
                )
              : 'Not configured'
          }
          color="success"
        />

      </div>


      {/* ======================================================
          Profile Details Card
      ====================================================== */}

      <div className="card p-6">

        {/* Employee Header */}

        <div
          className="
            flex
            items-center
            gap-4
            mb-6
            pb-6
            border-b
            border-navy-100
          "
        >

          <div
            className="
              w-20
              h-20
              rounded-2xl
              bg-gradient-to-br
              from-navy-700
              to-navy-900
              flex
              items-center
              justify-center
            "
          >

            <span
              className="
                text-3xl
                font-bold
                text-white
              "
            >
              {employeeInitial}
            </span>

          </div>


          <div>

            <h2
              className="
                text-xl
                font-bold
                text-navy-900
              "
            >
              {employeeName}
            </h2>


            <p
              className="
                text-sm
                text-navy-500
              "
            >
              {designation}
            </p>


            <div className="mt-1">
              <StatusBadge
                status={status}
              />
            </div>

          </div>

        </div>


        {/* ====================================================
            Profile Information
        ==================================================== */}

        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-2
            gap-6
          "
        >

          {fields.map(
            (field) => {
              const Icon =
                field.icon;

              return (
                <div
                  key={field.label}
                  className="
                    flex
                    items-start
                    gap-3
                  "
                >

                  <div
                    className="
                      w-10
                      h-10
                      rounded-lg
                      bg-navy-50
                      flex
                      items-center
                      justify-center
                      shrink-0
                    "
                  >

                    <Icon
                      size={18}
                      className="
                        text-navy-500
                      "
                    />

                  </div>


                  <div>

                    <p
                      className="
                        text-xs
                        font-medium
                        text-navy-400
                        uppercase
                        tracking-wider
                      "
                    >
                      {field.label}
                    </p>


                    <div
                      className="
                        text-sm
                        font-medium
                        text-navy-800
                        mt-0.5
                      "
                    >
                      {field.value}
                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>


        {/* ====================================================
            Salary Details
        ==================================================== */}

        <div
          className="
            mt-8
            pt-6
            border-t
            border-navy-100
          "
        >

          <h3
            className="
              text-base
              font-semibold
              text-navy-900
              mb-4
            "
          >
            Salary Information
          </h3>


          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-3
              gap-4
            "
          >

            <div
              className="
                rounded-lg
                bg-navy-50
                border
                border-navy-100
                p-4
              "
            >

              <p
                className="
                  text-xs
                  font-medium
                  text-navy-400
                  uppercase
                  tracking-wider
                  mb-1
                "
              >
                Base Salary / Month
              </p>

              <p
                className="
                  text-lg
                  font-bold
                  text-navy-900
                "
              >
                {baseSalary !== null
                  ? formatCurrency(
                      baseSalary
                    )
                  : 'Not configured'}
              </p>

            </div>


            <div
              className="
                rounded-lg
                bg-navy-50
                border
                border-navy-100
                p-4
              "
            >

              <p
                className="
                  text-xs
                  font-medium
                  text-navy-400
                  uppercase
                  tracking-wider
                  mb-1
                "
              >
                Expected Hours / Month
              </p>

              <p
                className="
                  text-lg
                  font-bold
                  text-navy-900
                "
              >
                {monthlyExpectedHours !== null
                  ? formatNumber(
                      monthlyExpectedHours
                    )
                  : 'Not configured'}
              </p>

            </div>


            <div
              className="
                rounded-lg
                bg-navy-50
                border
                border-navy-100
                p-4
              "
            >

              <p
                className="
                  text-xs
                  font-medium
                  text-navy-400
                  uppercase
                  tracking-wider
                  mb-1
                "
              >
                Hourly Rate
              </p>

              <p
                className="
                  text-lg
                  font-bold
                  text-navy-900
                "
              >
                {salaryRatePerHour !== null
                  ? formatCurrency(
                      salaryRatePerHour
                    )
                  : 'Not configured'}
              </p>

            </div>

          </div>


          <p
            className="
              mt-3
              text-xs
              text-navy-400
            "
          >
            Hourly rate is calculated from
            base salary ÷ expected monthly hours
            and is used for attendance-based payroll.
          </p>

        </div>

      </div>



      {/* ======================================================
          Account Security
      ====================================================== */}

      <div
        className="
          mt-6
          rounded-xl
          border
          border-navy-100
          bg-white
          p-6
          shadow-sm
        "
      >

        <div
          className="
            flex
            flex-col
            gap-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div className="flex items-start gap-4">

            <div
              className="
                flex
                h-12
                w-12
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-accent-50
              "
            >
              <LockKeyhole
                size={22}
                className="text-accent-600"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="
                    text-base
                    font-semibold
                    text-navy-900
                  "
                >
                  Account Security
                </h3>
                <ShieldCheck
                  size={17}
                  className="text-success-600"
                />
              </div>

              <p
                className="
                  mt-1
                  max-w-2xl
                  text-sm
                  text-navy-500
                "
              >
                Change the password used to sign in to your employee account.
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={openPasswordModal}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-navy-800
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              transition-colors
              hover:bg-navy-900
            "
          >
            <LockKeyhole size={16} />
            Change Password
          </button>

        </div>

      </div>


      {/* ======================================================
          Change Password Modal
      ====================================================== */}

      <Modal
        open={passwordModalOpen}
        onClose={closePasswordModal}
        title="Change Password"
        size="md"
      >

        <form
          onSubmit={handleChangePassword}
          className="space-y-5"
        >

          <div
            className="
              rounded-xl
              border
              border-accent-100
              bg-accent-50
              p-4
            "
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-accent-600"
              />
              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                    text-accent-900
                  "
                >
                  Password requirements
                </p>
                <p
                  className="
                    mt-1
                    text-xs
                    leading-5
                    text-accent-700
                  "
                >
                  Use 8 to 72 characters. Your new password must be different from the current password.
                </p>
              </div>
            </div>
          </div>

          <PasswordInput
            id="employee-current-password"
            label="Current Password"
            value={passwordForm.currentPassword}
            onChange={(value) =>
              updatePasswordField(
                'currentPassword',
                value
              )
            }
            showPassword={showCurrentPassword}
            onToggle={() =>
              setShowCurrentPassword(
                (previous) => !previous
              )
            }
            disabled={passwordSaving}
            autoComplete="current-password"
          />

          <PasswordInput
            id="employee-new-password"
            label="New Password"
            value={passwordForm.newPassword}
            onChange={(value) =>
              updatePasswordField(
                'newPassword',
                value
              )
            }
            showPassword={showNewPassword}
            onToggle={() =>
              setShowNewPassword(
                (previous) => !previous
              )
            }
            disabled={passwordSaving}
            autoComplete="new-password"
          />

          <PasswordInput
            id="employee-confirm-password"
            label="Confirm New Password"
            value={passwordForm.confirmPassword}
            onChange={(value) =>
              updatePasswordField(
                'confirmPassword',
                value
              )
            }
            showPassword={showConfirmPassword}
            onToggle={() =>
              setShowConfirmPassword(
                (previous) => !previous
              )
            }
            disabled={passwordSaving}
            autoComplete="new-password"
          />

          <div
            className="
              flex
              flex-col-reverse
              gap-2
              border-t
              border-navy-100
              pt-5
              sm:flex-row
              sm:justify-end
            "
          >
            <button
              type="button"
              onClick={closePasswordModal}
              disabled={passwordSaving}
              className="
                rounded-lg
                border
                border-navy-200
                bg-white
                px-4
                py-2.5
                text-sm
                font-medium
                text-navy-700
                hover:bg-navy-50
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={passwordSaving}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-lg
                bg-accent-600
                px-4
                py-2.5
                text-sm
                font-semibold
                text-white
                hover:bg-accent-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {passwordSaving
                ? 'Changing Password...'
                : 'Change Password'}
            </button>
          </div>

        </form>
      </Modal>

    </div>
  );
}