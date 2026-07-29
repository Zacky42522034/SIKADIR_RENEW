import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'default';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, children, className = '' }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'danger':
        return 'bg-danger/10 text-danger border-danger/20';
      case 'info':
        return 'bg-info/10 text-info border-info/20';
      case 'pending':
        return 'bg-pending/10 text-pending border-pending/20';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getVariantStyles()} ${className}`}
    >
      {children}
    </span>
  );
};
