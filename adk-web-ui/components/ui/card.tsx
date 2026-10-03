import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * The one surface used for panels across the site: white on the off-white
 * page in light mode, a lifted container in dark mode.
 */
export const panelClass =
  'rounded-[var(--md-shape-lg)] border border-md-outline/70 bg-md-surface dark:border-md-outline-variant dark:bg-md-surface-container';

const cardVariants = cva('rounded-[var(--md-shape-lg)] text-md-on-surface', {
  variants: {
    variant: {
      elevated: 'bg-md-surface-container-low dark:bg-md-surface-container shadow-elevation-1',
      filled: 'bg-md-surface-container-highest',
      outlined: 'border border-md-outline/70 bg-md-surface dark:border-md-outline-variant dark:bg-md-surface-container',
    },
    interactive: {
      true: 'transition-shadow hover:shadow-elevation-2 focus-within:ring-2 focus-within:ring-md-primary',
      false: '',
    },
  },
  defaultVariants: { variant: 'outlined', interactive: false },
});

export function Card({
  className,
  variant,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>) {
  return <div className={cn(cardVariants({ variant, interactive }), className)} {...props} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-medium leading-6', className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-md-on-surface-variant', className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4', className)} {...p} />;
}
export function CardFooter({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 px-4 pb-4', className)} {...p} />;
}
