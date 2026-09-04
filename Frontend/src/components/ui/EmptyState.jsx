import { Inbox } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-navy-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-navy-400" />
      </div>
      <h3 className="text-base font-semibold text-navy-800 mb-1">{title}</h3>
      {message && <p className="text-sm text-navy-500 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-error-100 flex items-center justify-center mb-4">
        <span className="text-2xl">!</span>
      </div>
      <h3 className="text-base font-semibold text-navy-800 mb-1">Something went wrong</h3>
      <p className="text-sm text-navy-500 max-w-sm">{message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4">Try Again</button>
      )}
    </div>
  );
}
