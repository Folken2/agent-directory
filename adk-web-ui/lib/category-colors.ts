// Category visuals — kept restrained: a small colored dot is the entire signal.
// We avoid purple (the canonical "AI startup" tell) and saturated badges.
export const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Research: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  Creative: {
    // pink/rose instead of purple — distinct without joining the AI-slop palette
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  Code: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  Data: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  Productivity: {
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
  },
};

export function getCategoryColors(category?: string) {
  if (!category || !CATEGORY_COLORS[category]) {
    return {
      bg: 'bg-md-surface-container',
      text: 'text-md-on-surface-variant',
      border: 'border-md-outline-variant',
      dot: 'bg-md-on-surface-variant',
    };
  }
  return CATEGORY_COLORS[category];
}
