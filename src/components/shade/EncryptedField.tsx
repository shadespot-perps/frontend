import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import type { PositionStatus } from '@/store/useStore';

interface EncryptedFieldProps {
  value: string;
  status: PositionStatus;
  className?: string;
  mono?: boolean;
}

export function EncryptedField({ value, status, className, mono = true }: EncryptedFieldProps) {
  if (status === 'decrypting') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-shade-teal', mono && 'font-mono', className)}>
        <span className="animate-pulse-teal">Decrypting...</span>
      </span>
    );
  }

  if (status === 'encrypted') {
    return (
      <span className={cn('inline-flex items-center gap-1.5', mono && 'font-mono', className)}>
        <Lock className="w-3 h-3 text-shade-text-muted" />
        <span className="encrypted-blur select-none">{value}</span>
      </span>
    );
  }

  return (
    <span className={cn('encrypted-reveal', mono && 'font-mono', className)}>
      {value}
    </span>
  );
}
