"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { AuthConfig } from "@/lib/cloudconfig";
import { updateAuthField } from "@/lib/useAuthConfig";

type ConsoleFrameProps = {
  title: string;
  description: string;
  auth: AuthConfig;
  onAuthChange: (nextAuth: AuthConfig) => void;
  children: ReactNode;
};

const links = [
  { href: "/", label: "Home" },
  { href: "/clients", label: "Clients" },
  { href: "/projects", label: "Projects" },
  { href: "/configs", label: "Configs" },
  { href: "/permissions", label: "Permissions" },
];

export function ConsoleFrame({
  title,
  description,
  auth,
  onAuthChange,
  children,
}: ConsoleFrameProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-2 text-sm text-zinc-300">{description}</p>
      </header>

      <nav className="flex flex-wrap gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Authentication</h2>
        <p className="mt-1 text-sm text-zinc-300">
          Requests are signed in the browser using your Ed25519 private key.
          Base URL and client ID are stored in session storage; private key stays
          in memory only.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-200">
            Server URL
            <input
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              placeholder="http://127.0.0.1:8080"
              value={auth.baseUrl}
              onChange={(event) =>
                onAuthChange(updateAuthField(auth, "baseUrl", event.target.value))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-zinc-200">
            Admin Client ID
            <input
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              placeholder="UUID"
              value={auth.clientId}
              onChange={(event) =>
                onAuthChange(updateAuthField(auth, "clientId", event.target.value))
              }
            />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-2 text-sm text-zinc-200">
          Admin Private Key (PEM)
          <textarea
            className="min-h-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="-----BEGIN PRIVATE KEY-----"
            value={auth.privateKeyPem}
            onChange={(event) =>
              onAuthChange(updateAuthField(auth, "privateKeyPem", event.target.value))
            }
          />
        </label>
      </section>

      <main className="pb-8">{children}</main>
    </div>
  );
}
