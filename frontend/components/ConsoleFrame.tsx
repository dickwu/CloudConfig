"use client";

import {
  ArrowsClockwise,
  GearSix,
  House,
  ShieldCheck,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ConfigModal } from "@/components/ConfigModal";
import { useConfigStore, useIsConfigured } from "@/lib/store";

type ConsoleFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
};

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/clients", label: "Clients", icon: UsersThree },
  { href: "/projects", label: "Projects", icon: SquaresFour },
  { href: "/configs", label: "Configs", icon: ArrowsClockwise },
  { href: "/permissions", label: "Permissions", icon: ShieldCheck },
];

export function ConsoleFrame({
  title,
  description,
  children,
}: ConsoleFrameProps) {
  const pathname = usePathname();
  const activeServer = useConfigStore((state) =>
    state.servers.find((server) => server.id === state.activeServerId),
  );
  const isConfigured = useIsConfigured();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const isConfigModalVisible = isConfigModalOpen || !isConfigured;

  const activeServerLabel = useMemo(() => {
    if (!activeServer) {
      return "No server configured";
    }
    const alias = activeServer.alias || "Unnamed";
    return `${alias} · ${truncateMiddle(activeServer.baseUrl)}`;
  }, [activeServer]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{title}</h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsConfigModalOpen(true)}
          className="focus-ring interactive inline-flex items-center gap-2 rounded-md border border-emerald-700/80 bg-emerald-950/40 px-3 py-2 text-sm font-medium text-emerald-200 hover:border-emerald-500/90"
        >
          <GearSix className="size-4" weight="duotone" />
          Config
        </button>
      </header>

      <nav className="flex flex-col gap-3 border-b border-zinc-800 pb-5 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-ring interactive inline-flex items-center gap-2 border-b-2 px-1 pb-1 text-sm ${
                  isActive
                    ? "border-emerald-400 text-emerald-200"
                    : "border-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <link.icon className="size-4" weight={isActive ? "duotone" : "regular"} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">
          <span className="pulse-soft size-2 rounded-full bg-emerald-400" />
          <span className="font-mono">
            {activeServerLabel}
          </span>
        </div>
      </nav>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 100, damping: 20 },
        }}
        className="pb-8 pt-6"
      >
        {children}
      </motion.main>
      <ConfigModal
        isOpen={isConfigModalVisible}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </div>
  );
}

function truncateMiddle(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 48) {
    return trimmed;
  }
  return `${trimmed.slice(0, 24)}...${trimmed.slice(-16)}`;
}
