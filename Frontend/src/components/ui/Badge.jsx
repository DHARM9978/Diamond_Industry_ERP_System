export function Badge({ children, variant = 'neutral', size = 'sm' }) {
  const variants = {
    neutral: 'bg-navy-100 text-navy-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    info: 'bg-accent-100 text-accent-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${variants[variant] || variants.neutral} ${sizes[size] || sizes.sm}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const statusConfig = {
    PENDING: {
      label: 'Pending',
      className: 'bg-warning-100 text-warning-700',
    },

    APPROVED: {
      label: 'Approved',
      className: 'bg-success-100 text-success-700',
    },

    REJECTED: {
      label: 'Rejected',
      className: 'bg-error-100 text-error-700',
    },

    CANCELLED: {
      label: 'Cancelled',
      className: 'bg-navy-100 text-navy-600',
    },
  };

  const config = statusConfig[
    String(status || '').toUpperCase()
  ] || {
    label: status || 'Unknown',
    className: 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
