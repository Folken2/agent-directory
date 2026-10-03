import * as React from 'react';
import { cn } from '@/lib/utils';

const field =
  'w-full rounded-[var(--md-shape-md)] border border-md-outline bg-transparent px-4 text-sm text-md-on-surface placeholder:text-md-on-surface-variant ' +
  'focus-visible:outline-none focus-visible:border-md-primary focus-visible:ring-1 focus-visible:ring-md-primary disabled:opacity-40';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, 'h-12', className)} {...p} />
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, 'min-h-24 py-3', className)} {...p} />
);
Textarea.displayName = 'Textarea';
