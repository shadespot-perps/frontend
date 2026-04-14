import { cn } from '@/lib/utils';
import { Unlock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PositionStatus } from '@/store/useStore';

interface DecryptButtonProps {
  status: PositionStatus;
  onDecrypt: () => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function DecryptButton({ status, onDecrypt, className, size = 'sm' }: DecryptButtonProps) {
  if (status === 'decrypted') return null;

  return (
    <Button
      variant="outline"
      size={size}
      onClick={onDecrypt}
      disabled={status === 'decrypting'}
      className={cn(
        'border-shade-teal/30 text-shade-teal hover:bg-shade-teal/10 hover:text-shade-teal',
        className
      )}
    >
      {status === 'decrypting' ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="ml-1.5 font-mono text-xs">2/3 sigs...</span>
        </>
      ) : (
        <>
          <Unlock className="w-3.5 h-3.5" />
          <span className="ml-1.5">Decrypt</span>
        </>
      )}
    </Button>
  );
}
