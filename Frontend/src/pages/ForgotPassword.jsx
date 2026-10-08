import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gem,
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

import { useToast } from '@/context/ToastContext';
import { ButtonSpinner } from '@/components/ui/Spinner';
import { authService } from '@/services/apiServices';

export function ForgotPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    setError('');

    if (!normalizedEmail) {
      const msg = 'Please enter your email address.';
      setError(msg);
      toast(msg, 'error');
      return;
    }

    setLoading(true);

    try {
      await authService.forgotPassword(normalizedEmail);

      setSubmitted(true);

      toast(
        'If an account exists with this email, password reset instructions have been sent.',
        'success'
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Unable to process your request. Please try again.';

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
          {/* Logo */}
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

          {/* Main Content */}
          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Secure account recovery
            </h2>

            <p className="text-navy-300 text-lg leading-relaxed">
              Reset your Diamond ERP password securely and get back to
              managing your workforce.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-8">
              {[
                {
                  label: 'Secure Recovery',
                  value: 'Protected',
                },
                {
                  label: 'Reset Link',
                  value: 'Time-limited',
                },
                {
                  label: 'Password Security',
                  value: 'Encrypted',
                },
                {
                  label: 'ERP Access',
                  value: 'Restored',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-navy-800/50 rounded-lg p-4 border border-navy-700"
                >
                  <p className="text-accent-300 font-semibold text-sm">
                    {item.value}
                  </p>

                  <p className="text-navy-400 text-xs mt-0.5">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-navy-400 text-sm">
            © 2026 Diamond ERP. All rights reserved.
          </p>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex-1 flex items-center justify-center p-6 bg-navy-50">
        <div className="w-full max-w-md">

          {/* Mobile Logo */}
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

            {/* FORM STATE */}
            {!submitted ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-navy-900 mb-1">
                    Forgot Password?
                  </h2>

                  <p className="text-sm text-navy-500">
                    Enter your registered email address and we will send you
                    instructions to reset your password.
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
                  {/* EMAIL */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">
                      Email Address
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
                      />

                      <input
                        type="email"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        placeholder="you@diamond.com"
                        required
                        autoComplete="email"
                        className="input-field pl-10"
                      />
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
                      <>
                        Send Reset Link
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                {/* BACK TO LOGIN */}
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
                  Check Your Email
                </h2>

                <p className="text-sm text-navy-500 leading-relaxed">
                  If an account exists with this email address,
                  password reset instructions have been sent.
                  Please check your inbox and follow the reset link.
                </p>

                <p className="text-xs text-navy-400 mt-4">
                  The reset link is valid for a limited time.
                </p>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}