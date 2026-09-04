import { useState, useEffect } from 'react';

import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  BadgeCheck,
} from 'lucide-react';

import {
  PageHeader,
  StatCard,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';

import { selfService } from '@/services/apiServices';

import {
  mockEmployeeProfile,
} from '@/services/mockData';


export function EmployeeProfile() {

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);


  // ============================================================
  // Load Employee Profile
  // ============================================================

  useEffect(() => {

    const load = async () => {

      try {

        const res = await selfService.profile();

        console.log(
          'Employee Profile:',
          res
        );

        setProfile(res);

      } catch (error) {

        console.error(
          'Failed to load employee profile:',
          error
        );

        setProfile(mockEmployeeProfile);

      } finally {

        setLoading(false);

      }

    };

    load();

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
  // Profile Data
  // ============================================================

  const p =
    profile || mockEmployeeProfile;


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

  const employeeName =
    p?.name ||
    `${firstName} ${lastName}`.trim() ||
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
    '—';

  const joinDate =
    p?.joinDate ||
    p?.join_date ||
    '—';

  const status =
    p?.status ||
    '—';


  // ============================================================
  // Tenure
  // ============================================================

  const tenure =
    joinDate !== '—'
      ? `Since ${String(joinDate).split('-')[0]}`
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
      value: joinDate,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

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
          Profile Details Card
      ====================================================== */}

      <div className="card p-6">


        {/* Employee Header */}

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-navy-100">

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

            <span className="text-3xl font-bold text-white">

              {employeeInitial}

            </span>

          </div>


          <div>

            <h2 className="text-xl font-bold text-navy-900">

              {employeeName}

            </h2>


            <p className="text-sm text-navy-500">

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {fields.map((field) => {

            const Icon = field.icon;

            return (

              <div
                key={field.label}
                className="flex items-start gap-3"
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
                    className="text-navy-500"
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

          })}

        </div>

      </div>

    </div>

  );

}