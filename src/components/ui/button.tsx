import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[var(--uq-yellow)] text-[var(--uq-ink)] hover:bg-[var(--uq-yellow-hover)] shadow-sm font-semibold",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 shadow-sm",
        outline:
          "border border-[var(--uq-yellow)] bg-[var(--uq-yellow)] text-[var(--uq-ink)] hover:bg-[var(--uq-yellow-hover)] shadow-sm font-semibold",
        secondary:
          "bg-[var(--uq-yellow-soft)] text-[var(--uq-ink)] hover:bg-[var(--uq-yellow)]",
        ghost:
          "text-[var(--uq-ink)] hover:bg-[var(--uq-yellow-soft)]",
        link: "text-[var(--uq-ink)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 rounded-lg px-6 has-[>svg]:px-4 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
