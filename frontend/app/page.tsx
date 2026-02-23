"use client";

import { ArrowsClockwise, GearSix, ShieldCheck, SquaresFour, UsersThree } from "@phosphor-icons/react";
import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ConfigModal } from "@/components/ConfigModal";
import { useConfigStore, useIsConfigured } from "@/lib/store";

const cards = [
  {
    href: "/clients",
    title: "Clients",
    description: "Create, list, and delete API clients.",
    icon: UsersThree,
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Create projects and inspect project metadata.",
    icon: SquaresFour,
  },
  {
    href: "/configs",
    title: "Configs",
    description: "Upsert and read project config values.",
    icon: ArrowsClockwise,
  },
  {
    href: "/permissions",
    title: "Permissions",
    description: "Grant or revoke client access to projects.",
    icon: ShieldCheck,
  },
];

const listVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 },
  },
};

export default function Home() {
  const isConfigured = useIsConfigured();
  const activeServer = useConfigStore((state) =>
    state.servers.find((server) => server.id === state.activeServerId),
  );
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const isConfigModalVisible = isConfigModalOpen || !isConfigured;
  const activeServerLabel = useMemo(() => {
    if (!activeServer) {
      return "No server configured";
    }
    const alias = activeServer.alias || "Unnamed";
    const baseUrl = activeServer.baseUrl.trim();
    if (baseUrl.length <= 44) {
      return `${alias} · ${baseUrl}`;
    }
    return `${alias} · ${baseUrl.slice(0, 24)}...${baseUrl.slice(-14)}`;
  }, [activeServer]);

  return (
    <div className="mx-auto grid min-h-[100dvh] w-full max-w-7xl grid-cols-1 gap-10 px-4 py-8 md:px-6 md:py-10 lg:grid-cols-[1.35fr_0.95fr] lg:gap-12">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 100, damping: 20 },
        }}
        className="flex flex-col justify-between gap-8 border-l-2 border-emerald-500/70 pl-4 md:pl-7"
      >
        <div className="space-y-6">
          <p className="w-fit rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-300">
            CloudConfig Console
          </p>
          <h1 className="max-w-[15ch] text-4xl font-semibold tracking-tighter text-zinc-100 md:text-6xl md:leading-none">
            Control clients, projects, and policy from one surface.
          </h1>
          <p className="max-w-[65ch] text-base leading-relaxed text-zinc-300">
            This frontend is embedded in the Rust binary and signs every admin request.
            Configure one or more servers, then switch between environments without
            leaving the console.
          </p>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200">
            <span className="pulse-soft size-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs md:text-sm">{activeServerLabel}</span>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="focus-ring interactive inline-flex items-center gap-2 rounded-md border border-emerald-700/90 bg-emerald-950/50 px-4 py-2 text-sm font-medium text-emerald-200 hover:border-emerald-500"
            >
              <GearSix className="size-4" weight="duotone" />
              Config Management
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="grid gap-3.5"
      >
        {cards.map((card) => (
          <motion.div key={card.href} variants={itemVariants}>
            <Link
              href={card.href}
              className="group block rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 pl-5 shadow-[0_20px_35px_-30px_rgba(16,185,129,0.9)]"
            >
              <div className="interactive rounded-md">
                <div className="flex items-start justify-between gap-3 border-l-2 border-emerald-500/70 pl-3">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-100">{card.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {card.description}
                    </p>
                  </div>
                  <span className="rounded-md border border-zinc-700 bg-zinc-900/80 p-2 text-emerald-300 transition group-hover:border-emerald-500/80 group-hover:text-emerald-200">
                    <card.icon className="size-4" weight="duotone" />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.section>
      <ConfigModal
        isOpen={isConfigModalVisible}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </div>
  );
}
