import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function isHorizontallyScrollable(element: HTMLElement | null) {
  let node: HTMLElement | null = element
  for (let depth = 0; node && depth < 7; depth += 1) {
    const style = window.getComputedStyle(node)
    const overflowX = style.overflowX
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 4
    ) {
      return true
    }
    node = node.parentElement
  }
  return false
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  const { style: contentStyle, ...contentProps } = props
  const contentRef = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const gestureRef = React.useRef({
    x: 0,
    y: 0,
    time: 0,
    axis: null as "x" | "y" | null,
    tracking: false,
  })
  const draggedRef = React.useRef(false)
  const dragOffsetRef = React.useRef(0)
  const dragActiveRef = React.useRef(false)
  const [drag, setDrag] = React.useState({ active: false, offset: 0 })

  const resetDrag = () => {
    gestureRef.current.axis = null
    gestureRef.current.tracking = false
    dragOffsetRef.current = 0
    dragActiveRef.current = false
    setDrag({ active: false, offset: 0 })
  }

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    contentProps.onTouchStart?.(event)
    gestureRef.current.tracking = false
    gestureRef.current.axis = null
    if (event.touches.length !== 1) return
    const target = event.target as HTMLElement
    if (isHorizontallyScrollable(target)) return
    if (target.closest("input, textarea, select")) return

    const touch = event.touches[0]
    if (!touch) return

    // Bottom and top sheets are often long and scrollable, so only pick up a
    // dismiss gesture from the grab strip in their header.
    const rect = contentRef.current?.getBoundingClientRect()
    if (rect) {
      if (side === "bottom" && touch.clientY - rect.top > 76) return
      if (side === "top" && rect.bottom - touch.clientY > 76) return
    }

    gestureRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      axis: null,
      tracking: true,
    }
    draggedRef.current = false
    setDrag({ active: false, offset: 0 })
  }

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    contentProps.onTouchMove?.(event)
    const touch = event.touches[0]
    if (!touch) return

    const start = gestureRef.current
    if (!start.tracking) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    if (!start.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return
      start.axis =
        side === "left" || side === "right"
          ? Math.abs(dx) > Math.abs(dy) * 1.1
            ? "x"
            : "y"
          : Math.abs(dy) > Math.abs(dx) * 1.1
            ? "y"
            : "x"
      if (start.axis === "y" && side !== "bottom" && side !== "top") return
      if (start.axis === "x" && side !== "left" && side !== "right") return
    }

    if (start.axis === "x" && (side === "left" || side === "right")) {
      const offset =
        side === "left" ? Math.max(0, -dx) : Math.max(0, dx)
      if (offset < 2) return
      if (event.cancelable) event.preventDefault()
      draggedRef.current = true
      dragOffsetRef.current = offset
      dragActiveRef.current = true
      setDrag({ active: true, offset })
      return
    }

    if (start.axis === "y" && (side === "bottom" || side === "top")) {
      const offset =
        side === "bottom" ? Math.max(0, dy) : Math.max(0, -dy)
      if (offset < 2) return
      if (event.cancelable) event.preventDefault()
      draggedRef.current = true
      dragOffsetRef.current = offset
      dragActiveRef.current = true
      setDrag({ active: true, offset })
    }
  }

  const finishDrag = () => {
    const start = gestureRef.current
    if (!start.tracking) return
    start.tracking = false
    const offset = dragOffsetRef.current
    const active = dragActiveRef.current
    const elapsed = Math.max(1, performance.now() - start.time)
    const velocity = offset / elapsed
    const rect = contentRef.current?.getBoundingClientRect()
    const size =
      side === "left" || side === "right"
        ? (rect?.width ?? 320)
        : (rect?.height ?? 240)
    const threshold = Math.min(120, size * 0.3)

    if (active && (offset > threshold || velocity > 0.55)) {
      draggedRef.current = false
      gestureRef.current.axis = null
      closeRef.current?.click()
      return
    }
    resetDrag()
    if (draggedRef.current) {
      window.setTimeout(() => {
        draggedRef.current = false
      }, 80)
    }
  }

  const onTouchCancel = () => {
    gestureRef.current.tracking = false
    draggedRef.current = false
    resetDrag()
  }

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggedRef.current) return
    event.preventDefault()
    event.stopPropagation()
    window.setTimeout(() => {
      draggedRef.current = false
    }, 0)
  }

  const swipeStyle: React.CSSProperties =
    drag.offset > 0
      ? {
          transform:
            side === "left" || side === "right"
              ? `translate3d(${side === "left" ? -drag.offset : drag.offset}px, 0, 0)`
              : `translate3d(0, ${side === "bottom" ? drag.offset : -drag.offset}px, 0)`,
          transition: drag.active
            ? "none"
            : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }
      : {}

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        data-sheet-side={side}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        style={{
          ...contentStyle,
          ...(side === "left" || side === "right"
            ? { touchAction: "pan-y" }
            : null),
          ...swipeStyle,
        }}
        {...contentProps}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finishDrag}
        onTouchCancel={onTouchCancel}
        onClickCapture={onClickCapture}
      >
        {children}
        <SheetPrimitive.Close
          ref={closeRef}
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
