import * as React from 'react';
import { Check } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex h-8 items-center gap-1.5 rounded-[var(--md-shape-sm)] px-3 text-[13px] font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary [&_svg]:size-4',
  {
    variants: {
      variant: {
        assist: 'border border-md-outline text-md-on-surface hover:bg-md-on-surface/8',
        filter: 'border border-md-outline text-md-on-surface-variant hover:bg-md-on-surface/8',
        category: 'bg-md-secondary-container text-md-on-secondary-container',
      },
      selected: { true: 'border-transparent bg-md-primary-container text-md-on-primary-container', false: '' },
    },
    defaultVariants: { variant: 'assist', selected: false },
  }
);

type ChipProps = VariantProps<typeof chipVariants> &
  React.HTMLAttributes<HTMLElement> & { onClick?: React.MouseEventHandler<HTMLButtonElement> };

export function Chip({ className, variant, selected, children, onClick, ...props }: ChipProps) {
  const classes = cn(chipVariants({ variant, selected }), className);
  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        aria-pressed={variant === 'filter' ? !!selected : undefined}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {variant === 'filter' && selected ? <Check aria-hidden /> : null}
        {children}
      </button>
    );
  }
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
