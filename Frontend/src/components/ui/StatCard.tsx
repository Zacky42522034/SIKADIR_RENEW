import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  trendLabel,
  className = '' 
}) => {
  return (
    <div className={`glass-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
        <div className="p-3 bg-primary/10 rounded-xl">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      
      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1.5 text-sm">
          {trend >= 0 ? (
            <TrendingUp className="w-4 h-4 text-success" />
          ) : (
            <TrendingDown className="w-4 h-4 text-danger" />
          )}
          <span className={`font-medium ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
          {trendLabel && (
            <span className="text-gray-400 ml-1">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
};
