"use client";

import type { ReactNode } from "react";

import { motion } from "framer-motion";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 100, damping: 20 },
      }}
      className={`flex flex-col items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4 ${className ?? ""}`}
    >
      <div className="rounded-md border border-zinc-700 bg-zinc-900/80 p-2 text-emerald-300">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="focus-ring interactive rounded-md border border-emerald-700/80 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:border-emerald-500/90"
        >
          {actionLabel}
        </button>
      ) : null}
    </motion.div>
  );
}
