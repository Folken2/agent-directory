import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[0.01em] transition-[background-color,box-shadow,color] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-surface ' +
    'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        filled: 'bg-md-primary text-md-on-primary hover:shadow-elevation-1 hover:bg-md-primary/92',
        tonal: 'bg-md-primary-container text-md-on-primary-container hover:shadow-elevation-1',
        outlined: 'border border-md-on-surface-variant/50 text-md-primary hover:bg-md-primary/8',
        elevated: 'bg-md-surface-container-low text-md-primary shadow-elevation-1 hover:shadow-elevation-2',
        text: 'text-md-primary hover:bg-md-primary/8',
      },
      size: {
        sm: 'h-8 px-3.5 text-[13px]',
        md: 'h-10 px-6 text-sm',
        icon: 'h-10 w-10 text-md-on-surface-variant hover:bg-md-on-surface/8',
      },
    },
    defaultVariants: { variant: 'filled', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type: type ?? 'button' })}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
