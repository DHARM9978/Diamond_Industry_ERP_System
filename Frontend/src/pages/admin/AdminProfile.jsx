
import { useEffect, useState } from 'react';

import {
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
  Pencil,
  Save,
  X,
  RefreshCw,
  LockKeyhole,
  Eye,
  EyeOff,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageComponents';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { authService } from '@/services/apiServices';


// ============================================================
// ADMIN PROFILE
// ============================================================

const getProfileObject = (response) => {
  if (response?.admin && typeof response.admin === 'object') {
    return response.admin;
  }

  if (response?.profile && typeof response.profile === 'object') {
    return response.profile;
  }

  return response || {};
};


const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message ||
  error?.message ||
  fallback
);


const normalizeProfile = (response) => {
  const profile = getProfileObject(response);

  return {
    adminName: profile.adminName ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    companyId: profile.companyId ?? null,
  };
};


const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;


// ============================================================
// Password Input (matches Employee Profile)
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
        required
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


export function AdminProfile() {
  const { toast } = useToast();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    adminName: '',
    email: '',
    phone: '',
    currentPassword: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showEmailCurrentPassword, setShowEmailCurrentPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailChanged = Boolean(
    profile &&
    form.email.trim().toLowerCase() !==
      String(profile.email || '').trim().toLowerCase()
  );


  // ============================================================
  // LOAD ADMIN PROFILE
  // ============================================================

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await authService.getAdminProfile();
      const nextProfile = normalizeProfile(response);

      setProfile(nextProfile);
      setForm({
        adminName: nextProfile.adminName,
        email: nextProfile.email,
        phone: nextProfile.phone,
        currentPassword: '',
      });
    } catch (loadError) {
      console.error('Failed to load admin profile:', loadError);

      const message = getErrorMessage(
        loadError,
        'Failed to load the admin profile.'
      );

      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadProfile();
  }, []);


  // ============================================================
  // FORM HELPERS
  // ============================================================

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };


  const startEditing = () => {
    if (!profile) return;

    setForm({
      adminName: profile.adminName,
      email: profile.email,
      phone: profile.phone,
      currentPassword: '',
    });

    setEditing(true);
  };


  const cancelEditing = () => {
    if (saving) return;

    setForm({
      adminName: profile?.adminName || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      currentPassword: '',
    });

    setEditing(false);
  };


  // ============================================================
  // SAVE ADMIN PROFILE
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    const adminName = form.adminName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!adminName) {
      toast('Enter the admin name.', 'error');
      return;
    }

    if (!email) {
      toast('Enter the login email address.', 'error');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      toast('Enter a valid email address.', 'error');
      return;
    }

    if (emailChanged && !form.currentPassword) {
      toast(
        'Enter your current password to change the login email.',
        'error'
      );
      return;
    }

    const profileData = {
      adminName,
      email,
      phone: phone || null,
    };

    if (emailChanged) {
      profileData.currentPassword = form.currentPassword;
    }

    try {
      setSaving(true);

      const response = await authService.updateAdminProfile(profileData);
      const updatedProfile = normalizeProfile(response);

      // Some APIs return an empty response after a successful update.
      // In that case, use the values that were submitted.
      const finalProfile = {
        adminName: updatedProfile.adminName || adminName,
        email: updatedProfile.email || email,
        phone: updatedProfile.phone || phone,
        companyId: updatedProfile.companyId ?? profile?.companyId ?? null,
      };

      setProfile(finalProfile);
      setForm({
        adminName: finalProfile.adminName,
        email: finalProfile.email,
        phone: finalProfile.phone,
        currentPassword: '',
      });
      setEditing(false);

      toast(
        emailChanged
          ? 'Profile updated. Use the new email address for your next login.'
          : 'Admin profile updated successfully.',
        'success'
      );
    } catch (saveError) {
      console.error('Failed to update admin profile:', saveError);

      toast(
        getErrorMessage(saveError, 'Failed to update the admin profile.'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };


  // ============================================================
  // CHANGE ADMIN PASSWORD
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


  const handlePasswordSubmit = async (event) => {
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

    if (
      newPassword.length < PASSWORD_MIN_LENGTH ||
      newPassword.length > PASSWORD_MAX_LENGTH
    ) {
      toast(
        `New password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
        'error'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast('The new password and confirmation do not match.', 'error');
      return;
    }

    if (newPassword === currentPassword) {
      toast(
        'The new password must be different from the current password.',
        'error'
      );
      return;
    }

    try {
      setPasswordSaving(true);

      await authService.changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordModalOpen(false);
      resetPasswordForm();

      toast(
        'Password changed successfully. Use the new password the next time you log in.',
        'success'
      );
    } catch (passwordError) {
      console.error('Failed to change admin password:', passwordError);

      toast(
        getErrorMessage(
          passwordError,
          'Failed to change the admin password.'
        ),
        'error'
      );
    } finally {
      setPasswordSaving(false);
    }
  };


  // ============================================================
  // LOADING / ERROR STATES
  // ============================================================

  if (loading) {
    return <FullPageSpinner />;
  }

  if (error && !profile) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Admin Profile"
          subtitle="Manage your administrator account details."
        />

        <div className="rounded-xl border border-error-200 bg-error-50 p-5">
          <p className="text-sm font-medium text-error-700">
            {error}
          </p>

          <button
            type="button"
            onClick={loadProfile}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy-700 shadow-sm ring-1 ring-navy-200 transition hover:bg-navy-50"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </div>
    );
  }


  // ============================================================
  // MAIN VIEW
  // ============================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Profile"
        subtitle="Manage your personal administrator details and login identity."
        actions={
          !editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
            >
              <Pencil size={16} />
              Edit Profile
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
          <div className="flex items-center gap-4 border-b border-navy-100 bg-gradient-to-r from-navy-50 to-white px-6 py-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-white shadow-sm">
              <UserRound size={27} />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-navy-900">
                {profile?.adminName || 'Administrator'}
              </h2>
              <p className="truncate text-sm text-navy-500">
                {profile?.email || 'No login email available'}
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
              <ShieldCheck size={14} />
              Admin
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            <div>
              <label
                htmlFor="admin-profile-name"
                className="mb-1.5 block text-sm font-medium text-navy-700"
              >
                Admin name
              </label>

              <div className="relative">
                <UserRound
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
                />
                <input
                  id="admin-profile-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={form.adminName}
                  onChange={(event) => updateField('adminName', event.target.value)}
                  disabled={!editing || saving}
                  className="input-field w-full pl-10 disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-navy-500"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-profile-email"
                className="mb-1.5 block text-sm font-medium text-navy-700"
              >
                Login email
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
                />
                <input
                  id="admin-profile-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  disabled={!editing || saving}
                  className="input-field w-full pl-10 disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-navy-500"
                  required
                />
              </div>

              {editing && (
                <p className="mt-1.5 text-xs leading-5 text-navy-500">
                  This is your admin login email, not the company's contact email.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="admin-profile-phone"
                className="mb-1.5 block text-sm font-medium text-navy-700"
              >
                Phone number
              </label>

              <div className="relative">
                <Phone
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
                />
                <input
                  id="admin-profile-phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  disabled={!editing || saving}
                  className="input-field w-full pl-10 disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-navy-500"
                />
              </div>
            </div>

            {editing && emailChanged && (
              <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning-800">
                  <LockKeyhole size={16} />
                  Confirm your identity
                </div>

                <p className="mb-3 text-xs leading-5 text-warning-800">
                  Enter your current password to authorize the login-email change.
                </p>

                <label
                  htmlFor="admin-profile-current-password"
                  className="mb-1.5 block text-sm font-medium text-navy-700"
                >
                  Current password
                </label>

                <div className="relative">
                  <input
                    id="admin-profile-current-password"
                    type={showEmailCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.currentPassword}
                    onChange={(event) => updateField('currentPassword', event.target.value)}
                    disabled={saving}
                    className="input-field w-full pr-11"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowEmailCurrentPassword((previous) => !previous)}
                    disabled={saving}
                    aria-label={
                      showEmailCurrentPassword
                        ? 'Hide current password'
                        : 'Show current password'
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 transition-colors hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showEmailCurrentPassword
                      ? <EyeOff size={18} />
                      : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {editing && (
              <div className="flex flex-wrap justify-end gap-3 border-t border-navy-100 pt-5">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={16} />
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <ShieldCheck size={21} />
            </div>

            <h3 className="font-semibold text-navy-900">
              Account security
            </h3>

            <p className="mt-2 text-sm leading-6 text-navy-600">
              Your login email identifies your administrator account. Company contact details are managed separately under Company.
            </p>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-navy-50 p-3">
              <LockKeyhole size={16} className="mt-0.5 shrink-0 text-navy-500" />
              <p className="text-xs leading-5 text-navy-600">
                Never share your password. A login-email change requires your current password.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-navy-100 text-navy-700">
              <Building2 size={21} />
            </div>

            <h3 className="font-semibold text-navy-900">
              Company information
            </h3>

            <p className="mt-2 text-sm leading-6 text-navy-600">
              Company name, contact email, phone, and address belong in the Company Details section, not in your admin login profile.
            </p>
          </section>
        </aside>
      </div>

      {/* ======================================================
          Account Security — matches Employee Profile
      ====================================================== */}

      <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <LockKeyhole size={21} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-navy-900">
                  Account Security
                </h2>
                <ShieldCheck size={17} className="text-success-600" />
              </div>

              <p className="mt-1 max-w-2xl text-sm text-navy-500">
                Change the password used to sign in to your administrator account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openPasswordModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
          >
            <LockKeyhole size={16} />
            Change Password
          </button>
        </div>
      </section>

      {/* ======================================================
          Change Password Modal (matches Employee Profile)
      ====================================================== */}

      <Modal
        open={passwordModalOpen}
        onClose={closePasswordModal}
        title="Change Password"
        size="md"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <div className="rounded-xl border border-accent-100 bg-accent-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent-600" />

              <div>
                <p className="text-sm font-semibold text-accent-900">
                  Password requirements
                </p>

                <p className="mt-1 text-xs leading-5 text-accent-700">
                  Use 8 to 72 characters. Your new password must be different from the current password.
                </p>
              </div>
            </div>
          </div>

          <PasswordInput
            id="admin-current-password"
            label="Current Password"
            value={passwordForm.currentPassword}
            onChange={(value) => updatePasswordField('currentPassword', value)}
            showPassword={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((previous) => !previous)}
            disabled={passwordSaving}
            autoComplete="current-password"
          />

          <PasswordInput
            id="admin-new-password"
            label="New Password"
            value={passwordForm.newPassword}
            onChange={(value) => updatePasswordField('newPassword', value)}
            showPassword={showNewPassword}
            onToggle={() => setShowNewPassword((previous) => !previous)}
            disabled={passwordSaving}
            autoComplete="new-password"
          />

          <PasswordInput
            id="admin-confirm-password"
            label="Confirm New Password"
            value={passwordForm.confirmPassword}
            onChange={(value) => updatePasswordField('confirmPassword', value)}
            showPassword={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((previous) => !previous)}
            disabled={passwordSaving}
            autoComplete="new-password"
          />

          <div className="flex flex-col-reverse gap-2 border-t border-navy-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closePasswordModal}
              disabled={passwordSaving}
              className="rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passwordSaving ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
