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
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';

import { selfService } from '@/services/apiServices';


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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};


// ============================================================
// Main Component
// ============================================================

export function EmployeeProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


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

    </div>
  );
}