import { Loader2 } from 'lucide-react';

export function Spinner({ size = 24, className = '' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function FullPageSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner size={32} className="text-accent-600" />
      <p className="text-sm text-navy-500">{message}</p>
    </div>
  );
}

export function ButtonSpinner() {
  return <Spinner size={16} className="text-white" />;
}
