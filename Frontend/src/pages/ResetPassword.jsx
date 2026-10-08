import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Gem,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';

import { useToast } from '@/context/ToastContext';
import { ButtonSpinner } from '@/components/ui/Spinner';
import { authService } from '@/services/apiServices';

export function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resetSuccessful, setResetSuccessful] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (!token) {
      const msg = 'This password reset link is invalid or missing.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    if (!newPassword) {
      const msg = 'Please enter a new password.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    if (newPassword.length < 8) {
      const msg = 'Password must be at least 8 characters long.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    if (newPassword.length > 72) {
      const msg = 'Password cannot be longer than 72 characters.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    if (!confirmPassword) {
      const msg = 'Please confirm your new password.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, newPassword);

      setResetSuccessful(true);

      toast(
        'Your password has been reset successfully.',
        'success'
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Unable to reset your password. The link may have expired or become invalid.';

      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT BRANDING PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 20%, #3889ec 0%, transparent 50%), radial-gradient(circle at 70% 80%, #3889ec 0%, transparent 40%)',
          }}
        />

        <div className="relative flex flex-col justify-between p-12 text-white">

          {/* LOGO */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <Gem size={24} className="text-white" />
            </div>

            <div>
              <h1 className="font-bold text-lg">
                Diamond ERP
              </h1>

              <p className="text-navy-300 text-sm">
                Workforce Management Suite
              </p>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Protect your account
            </h2>

            <p className="text-navy-300 text-lg leading-relaxed">
              Create a new secure password and continue using
              Diamond ERP safely.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-8">

              <div className="bg-navy-800/50 rounded-lg p-4 border border-navy-700">
                <p className="text-accent-300 font-semibold text-sm">
                  Secure
                </p>

                <p className="text-navy-400 text-xs mt-0.5">
                  Password Reset
                </p>
              </div>

              <div className="bg-navy-800/50 rounded-lg p-4 border border-navy-700">
                <p className="text-accent-300 font-semibold text-sm">
                  Protected
                </p>

                <p className="text-navy-400 text-xs mt-0.5">
                  Account Access
                </p>
              </div>

              <div className="bg-navy-800/50 rounded-lg p-4 border border-navy-700">
                <p className="text-accent-300 font-semibold text-sm">
                  Encrypted
                </p>

                <p className="text-navy-400 text-xs mt-0.5">
                  Credentials
                </p>
              </div>

              <div className="bg-navy-800/50 rounded-lg p-4 border border-navy-700">
                <p className="text-accent-300 font-semibold text-sm">
                  Restored
                </p>

                <p className="text-navy-400 text-xs mt-0.5">
                  ERP Access
                </p>
              </div>

            </div>
          </div>

          {/* FOOTER */}
          <p className="text-navy-400 text-sm">
            © 2026 Diamond ERP. All rights reserved.
          </p>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex-1 flex items-center justify-center p-6 bg-navy-50">
        <div className="w-full max-w-md">

          {/* MOBILE LOGO */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <Gem size={20} className="text-white" />
            </div>

            <h1 className="font-bold text-lg text-navy-900">
              Diamond ERP
            </h1>
          </div>

          {/* CARD */}
          <div className="card p-8">

            {!resetSuccessful ? (
              <>
                {/* HEADER */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-navy-900 mb-1">
                    Reset Password
                  </h2>

                  <p className="text-sm text-navy-500">
                    Enter your new password below to secure your
                    Diamond ERP account.
                  </p>
                </div>

                {/* ERROR */}
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-error-50 border border-error-200 text-error-700 text-sm">
                    {error}
                  </div>
                )}

                {/* FORM */}
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >

                  {/* NEW PASSWORD */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">
                      New Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
                      />

                      <input
                        type={
                          showNewPassword
                            ? 'text'
                            : 'password'
                        }
                        value={newPassword}
                        onChange={(e) =>
                          setNewPassword(e.target.value)
                        }
                        placeholder="Enter new password"
                        required
                        autoComplete="new-password"
                        className="input-field pl-10 pr-10"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowNewPassword(
                            (value) => !value
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"
                        aria-label={
                          showNewPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-navy-400">
                      Password must contain 8 to 72 characters.
                    </p>
                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">
                      Confirm Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
                      />

                      <input
                        type={
                          showConfirmPassword
                            ? 'text'
                            : 'password'
                        }
                        value={confirmPassword}
                        onChange={(e) =>
                          setConfirmPassword(e.target.value)
                        }
                        placeholder="Confirm new password"
                        required
                        autoComplete="new-password"
                        className="input-field pl-10 pr-10"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(
                            (value) => !value
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"
                        aria-label={
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* SUBMIT */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                  >
                    {loading ? (
                      <ButtonSpinner />
                    ) : (
                      'Reset Password'
                    )}
                  </button>

                </form>

                {/* BACK */}
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="mt-6 w-full flex items-center justify-center gap-2 text-sm font-medium text-navy-500 hover:text-navy-700 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Login
                </button>
              </>
            ) : (
              /* SUCCESS STATE */
              <div className="text-center">

                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-success-50 flex items-center justify-center">
                  <CheckCircle
                    size={30}
                    className="text-success-600"
                  />
                </div>

                <h2 className="text-2xl font-bold text-navy-900 mb-2">
                  Password Reset Successful
                </h2>

                <p className="text-sm text-navy-500 leading-relaxed">
                  Your password has been changed successfully.
                  You can now sign in to Diamond ERP using your
                  new password.
                </p>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Go to Login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}