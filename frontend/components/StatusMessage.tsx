"use client";

import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

type StatusMessageVariant = "success" | "error";

type StatusMessageProps = {
  text: string | null;
  variant: StatusMessageVariant;
  onDismiss?: () => void;
};

const variantStyles: Record<StatusMessageVariant, string> = {
  success:
    "border-emerald-700/70 bg-emerald-950/40 text-emerald-100 shadow-[0_8px_28px_-20px_rgba(16,185,129,0.9)]",
  error:
    "border-red-800/70 bg-red-950/40 text-red-100 shadow-[0_8px_28px_-20px_rgba(239,68,68,0.9)]",
};

export function StatusMessage({ text, variant, onDismiss }: StatusMessageProps) {
  const accessibilityProps =
    variant === "error"
      ? { role: "alert" as const, "aria-live": "assertive" as const }
      : { role: "status" as const, "aria-live": "polite" as const };

  return (
    <AnimatePresence mode="wait">
      {text ? (
        <motion.div
          key={`${variant}-${text}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { type: "spring", stiffness: 100, damping: 20 },
          }}
          exit={{
            opacity: 0,
            y: -6,
            transition: { duration: 0.14, ease: "easeOut" },
          }}
          {...accessibilityProps}
          className={`mt-4 flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${variantStyles[variant]}`}
        >
          <div className="flex items-start gap-2">
            {variant === "success" ? (
              <CheckCircle className="mt-0.5 size-4 shrink-0" weight="duotone" />
            ) : (
              <WarningCircle className="mt-0.5 size-4 shrink-0" weight="duotone" />
            )}
            <p>{text}</p>
          </div>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="focus-ring interactive rounded-md border border-current/40 p-1 opacity-80 hover:opacity-100"
              aria-label="Dismiss message"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
