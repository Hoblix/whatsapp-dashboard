import * as React from "react"
import { cn } from "@/lib/utils"
import { User } from "lucide-react"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Avatar({ className, src, fallback, size = "md", ...props }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10 md:w-12 md:h-12",
    lg: "w-14 h-14",
    xl: "w-20 h-20"
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-slate-200 border border-slate-100",
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt="Avatar"
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-500 font-medium">
          {fallback ? fallback.substring(0, 2).toUpperCase() : <User className="w-1/2 h-1/2 opacity-50" />}
        </div>
      )}
    </div>
  )
}
