"use client";

import { useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import {
  ensureAuthConfig,
  requireUuid,
  signedJsonRequest,
  toPathSegment,
} from "@/lib/cloudconfig";
import { useAuthConfig } from "@/lib/useAuthConfig";
import type { Client, CreateClientResponse } from "@/lib/types";

export default function ClientsPage() {
  const { auth, setAuth } = useAuthConfig();
  const [clients, setClients] = useState<Client[]>([]);
  const [createName, setCreateName] = useState("");
  const [createdClientSecret, setCreatedClientSecret] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchClients() {
    ensureAuthConfig(auth);
    const response = await signedJsonRequest<Client[]>(
      auth,
      "GET",
      "/admin/clients",
    );
    setClients(response);
    return response.length;
  }

  async function listClients() {
    await runWithFeedback(async () => {
      const count = await fetchClients();
      setMessage(`Loaded ${count} clients.`);
    });
  }

  async function createClient() {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      if (!createName.trim()) {
        throw new Error("Client name is required.");
      }
      const response = await signedJsonRequest<CreateClientResponse>(
        auth,
        "POST",
        "/admin/clients",
        { name: createName.trim() },
      );
      setCreateName("");
      setCreatedClientSecret(response.private_key_pem);
      const count = await fetchClients();
      setMessage(`Created client ${response.client.name}. Loaded ${count} clients.`);
    });
  }

  async function deleteClient(clientId: string) {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      const clientPath = toPathSegment(requireUuid(clientId, "Client ID"));
      await signedJsonRequest<undefined>(
        auth,
        "DELETE",
        `/admin/clients/${clientPath}`,
      );
      const count = await fetchClients();
      setMessage(`Deleted client ${clientId}. Loaded ${count} clients.`);
    });
  }

  async function runWithFeedback(task: () => Promise<void>) {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await task();
    } catch (taskError) {
      setError(
        taskError instanceof Error ? taskError.message : "Unknown request error.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConsoleFrame
      title="Clients"
      description="Create and manage CloudConfig clients."
      auth={auth}
      onAuthChange={setAuth}
    >
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Create client</h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Client name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          <button
            type="button"
            onClick={createClient}
            disabled={loading}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create
          </button>
          <button
            type="button"
            onClick={listClients}
            disabled={loading}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh list
          </button>
        </div>
        {createdClientSecret && (
          <div className="mt-4 rounded-md border border-emerald-700 bg-emerald-950 p-3">
            <p className="text-sm text-emerald-200">
              Newly created private key (shown once):
            </p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-emerald-100">
              {createdClientSecret}
            </pre>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Client list</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-zinc-200">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Admin</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-zinc-800">
                  <td className="py-2 pr-4">{client.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{client.id}</td>
                  <td className="py-2 pr-4">
                    {client.is_admin ? "yes" : "no"}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => deleteClient(client.id)}
                      disabled={loading}
                      className="rounded-md border border-red-700 px-3 py-1 text-red-200 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td className="py-3 text-zinc-400" colSpan={4}>
                    No clients loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && (
        <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-950 p-3 text-sm text-emerald-100">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-700 bg-red-950 p-3 text-sm text-red-100">
          {error}
        </p>
      )}
    </ConsoleFrame>
  );
}
