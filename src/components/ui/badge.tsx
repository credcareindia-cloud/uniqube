import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-slate-100 text-slate-800 [a&]:hover:bg-slate-200",
        secondary:
          "bg-slate-50 text-slate-600 [a&]:hover:bg-slate-100",
        destructive:
          "bg-red-100 text-red-800 [a&]:hover:bg-red-200",
        outline:
          "border border-slate-300 text-slate-700 [a&]:hover:bg-slate-50",
        success:
          "bg-green-100 text-green-800 [a&]:hover:bg-green-200",
        warning:
          "bg-amber-100 text-amber-800 [a&]:hover:bg-amber-200",
        info:
          "bg-blue-100 text-blue-800 [a&]:hover:bg-blue-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
