import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { MatchStatusSchema } from '@sportshub/validation';

interface MatchStatusBadgeProps {
  status: MatchStatusSchema;
}

export const MatchStatusBadge: React.FC<MatchStatusBadgeProps> = ({ status }) => {
  let variant: 'default' | 'success' | 'warning' | 'info' | 'error' | 'outline' = 'default';
  
  switch (status) {
    case 'DRAFT':
      variant = 'outline';
      break;
    case 'SCHEDULED':
      variant = 'info';
      break;
    case 'WARMUP':
    case 'LIVE':
      variant = 'success';
      break;
    case 'PAUSED':
      variant = 'warning';
      break;
    case 'COMPLETED':
      variant = 'default'; // Or success, but completed might be greyed out. Let's use default.
      break;
    case 'ABANDONED':
    case 'CANCELLED':
      variant = 'error';
      break;
  }

  return <Badge variant={variant}>{status}</Badge>;
};
