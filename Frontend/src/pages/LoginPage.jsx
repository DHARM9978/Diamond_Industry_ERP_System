import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ButtonSpinner } from '@/components/ui/Spinner';

export function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      toast(`Welcome back, ${user.name}!`, 'success');
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials. Please try again.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (type) => {
    if (type === 'admin') {
      setEmail('admin@diamond.com');
      setPassword('Admin@123');
    } else {
      setEmail('employee@diamond.com');
      setPassword('Employee@123');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 30% 20%, #3889ec 0%, transparent 50%), radial-gradient(circle at 70% 80%, #3889ec 0%, transparent 40%)'
        }} />
        <div className="relative flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <Gem size={24} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Diamond ERP</h1>
              <p className="text-navy-300 text-sm">Workforce Management Suite</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Manage your diamond workforce with precision
            </h2>
            <p className="text-navy-300 text-lg leading-relaxed">
              Attendance, payroll, leaves, salary advances, fingerprint devices — all unified in one elegant platform built for the diamond industry.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {[
                { label: 'Attendance Tracking', value: 'Real-time' },
                { label: 'Payroll Management', value: 'Automated' },
                { label: 'Leave Workflow', value: 'Streamlined' },
                { label: 'Fingerprint Devices', value: 'Integrated' },
              ].map((item) => (
                <div key={item.label} className="bg-navy-800/50 rounded-lg p-4 border border-navy-700">
                  <p className="text-accent-300 font-semibold text-sm">{item.value}</p>
                  <p className="text-navy-400 text-xs mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-navy-400 text-sm">© 2026 Diamond ERP. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-navy-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <Gem size={20} className="text-white" />
            </div>
            <h1 className="font-bold text-lg text-navy-900">Diamond ERP</h1>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-navy-900 mb-1">Sign In</h2>
            <p className="text-sm text-navy-500 mb-6">Enter your credentials to access the dashboard</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-50 border border-error-200 text-error-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy-700">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@diamond.com"
                    required
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy-700">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-field pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <ButtonSpinner /> : <>
                  Sign In <ArrowRight size={18} />
                </>}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 pt-6 border-t border-navy-100">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-3">Demo Credentials</p>
              <div className="space-y-2">
                <button
                  onClick={() => fillCredentials('admin')}
                  className="w-full text-left p-3 rounded-lg bg-navy-50 hover:bg-navy-100 transition-colors border border-navy-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-navy-800">Admin Login</p>
                      <p className="text-xs text-navy-500">admin@diamond.com · Admin@123</p>
                    </div>
                    <span className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded-full font-medium">Click to fill</span>
                  </div>
                </button>
                <button
                  onClick={() => fillCredentials('employee')}
                  className="w-full text-left p-3 rounded-lg bg-navy-50 hover:bg-navy-100 transition-colors border border-navy-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-navy-800">Employee Login</p>
                      <p className="text-xs text-navy-500">employee@diamond.com · Employee@123</p>
                    </div>
                    <span className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded-full font-medium">Click to fill</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
