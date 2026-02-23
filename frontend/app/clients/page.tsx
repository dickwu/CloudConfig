"use client";

import { Check, Copy, Trash, UsersThree } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusMessage } from "@/components/StatusMessage";
import {
  requireAuthConfig,
  requireUuid,
  signedJsonRequest,
  toPathSegment,
} from "@/lib/cloudconfig";
import { useActiveAuth, useConfigStore } from "@/lib/store";
import type { Client, CreateClientResponse } from "@/lib/types";

export default function ClientsPage() {
  const auth = useActiveAuth();
  const activeServerId = useConfigStore((state) => state.activeServerId);
  const [clients, setClients] = useState<Client[]>([]);
  const [createName, setCreateName] = useState("");
  const [createdClientSecret, setCreatedClientSecret] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const requestEpochRef = useRef(0);
  const copiedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAuthFingerprint = auth
    ? `${auth.baseUrl}|${auth.clientId}|${auth.privateKeyPem}`
    : "";

  useEffect(() => {
    requestEpochRef.current += 1;
    setClients([]);
    setCreatedClientSecret("");
    setCopiedSecret(false);
    setMessage("");
    setError("");
    setLoading(false);
  }, [activeServerId, activeAuthFingerprint]);

  useEffect(() => {
    return () => {
      if (copiedResetTimerRef.current) {
        clearTimeout(copiedResetTimerRef.current);
      }
    };
  }, []);

  async function fetchClients(requestEpoch: number) {
    const currentAuth = requireAuthConfig(auth);
    const response = await signedJsonRequest<Client[]>(
      currentAuth,
      "GET",
      "/admin/clients",
    );
    if (requestEpoch !== requestEpochRef.current) {
      return 0;
    }
    setClients(response);
    return response.length;
  }

  async function listClients() {
    await runWithFeedback(async (requestEpoch) => {
      const count = await fetchClients(requestEpoch);
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setMessage(`Loaded ${count} clients.`);
    });
  }

  async function createClient() {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      if (!createName.trim()) {
        throw new Error("Client name is required.");
      }
      const response = await signedJsonRequest<CreateClientResponse>(
        currentAuth,
        "POST",
        "/admin/clients",
        { name: createName.trim() },
      );
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setCreateName("");
      setCreatedClientSecret(response.private_key_pem);
      setCopiedSecret(false);
      const count = await fetchClients(requestEpoch);
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setMessage(`Created client ${response.client.name}. Loaded ${count} clients.`);
    });
  }

  async function deleteClient(clientId: string) {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      const clientPath = toPathSegment(requireUuid(clientId, "Client ID"));
      await signedJsonRequest<undefined>(
        currentAuth,
        "DELETE",
        `/admin/clients/${clientPath}`,
      );
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      const count = await fetchClients(requestEpoch);
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setMessage(`Deleted client ${clientId}. Loaded ${count} clients.`);
    });
  }

  async function runWithFeedback(task: (requestEpoch: number) => Promise<void>) {
    const requestEpoch = requestEpochRef.current;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await task(requestEpoch);
    } catch (taskError) {
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setError(
        taskError instanceof Error ? taskError.message : "Unknown request error.",
      );
    } finally {
      if (requestEpoch === requestEpochRef.current) {
        setLoading(false);
      }
    }
  }

  async function copyClientSecret() {
    if (!createdClientSecret) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdClientSecret);
      setCopiedSecret(true);
      if (copiedResetTimerRef.current) {
        clearTimeout(copiedResetTimerRef.current);
      }
      copiedResetTimerRef.current = setTimeout(() => {
        setCopiedSecret(false);
      }, 1800);
      setMessage("Private key copied to clipboard.");
    } catch (copyError) {
      setError(
        copyError instanceof Error ? copyError.message : "Failed to copy private key.",
      );
    }
  }

  return (
    <ConsoleFrame
      title="Clients"
      description="Create and manage CloudConfig clients."
    >
      <section className="border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Create client</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Client name</span>
            <input
              className="focus-ring w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              placeholder="e.g. production-api"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Name appears in client listings and audit output.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createClient}
              disabled={loading}
              className="focus-ring interactive rounded-md border border-emerald-700/80 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create client
            </button>
            <button
              type="button"
              onClick={listClients}
              disabled={loading}
              className="focus-ring interactive rounded-md border border-zinc-600 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh list
            </button>
          </div>
        </div>
        {createdClientSecret && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { type: "spring", stiffness: 100, damping: 20 },
            }}
            className="mt-4 rounded-lg border border-emerald-700/70 bg-emerald-950/35 p-3"
          >
            <p className="text-sm text-emerald-200">
              Newly created private key (shown once):
            </p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-emerald-100">
              {createdClientSecret}
            </pre>
            <button
              type="button"
              onClick={copyClientSecret}
              className="focus-ring interactive mt-3 inline-flex items-center gap-2 rounded-md border border-emerald-700/80 bg-emerald-950/60 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:border-emerald-500"
            >
              {copiedSecret ? (
                <Check className="size-3.5" weight="bold" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiedSecret ? "Copied" : "Copy key"}
            </button>
          </motion.div>
        )}
      </section>

      <section className="mt-6 border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Client list</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-zinc-200">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-zinc-500">
                  Name
                </th>
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-zinc-500">
                  ID
                </th>
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-zinc-500">
                  Admin
                </th>
                <th className="py-2 text-xs uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && clients.length === 0 ? (
                <LoadingSkeleton rows={3} colSpan={4} />
              ) : null}
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/50"
                >
                  <td className="py-2 pr-4">{client.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{client.id}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {client.is_admin ? "yes" : "no"}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => deleteClient(client.id)}
                      disabled={loading}
                      className="focus-ring interactive inline-flex items-center gap-1.5 rounded-md border border-red-800/80 px-3 py-1 text-red-200 hover:border-red-600 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash className="size-3.5" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && clients.length === 0 && (
                <tr>
                  <td className="py-4" colSpan={4}>
                    <EmptyState
                      icon={<UsersThree className="size-5" weight="duotone" />}
                      title="No clients loaded"
                      description="Create a new client or refresh the list after switching servers."
                      actionLabel="Refresh list"
                      onAction={listClients}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <StatusMessage
        text={message}
        variant="success"
        onDismiss={() => setMessage("")}
      />
      <StatusMessage text={error} variant="error" onDismiss={() => setError("")} />
    </ConsoleFrame>
  );
}
