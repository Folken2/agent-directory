import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The M3 type scale (`text-label-small`, `text-body-large`, …) lives in
 * globals.css. Registered as font sizes here, so merging one with a text
 * colour such as `text-md-on-surface` keeps both instead of dropping the type
 * style as a conflicting colour.
 */
export const TYPE_SCALE = ["display", "headline", "title", "body", "label"].flatMap((role) =>
  ["large", "medium", "small"].map((size) => `${role}-${size}`)
)

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: TYPE_SCALE }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
