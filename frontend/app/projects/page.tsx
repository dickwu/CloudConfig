"use client";

import { FolderOpen } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusMessage } from "@/components/StatusMessage";
import { requireAuthConfig, signedJsonRequest } from "@/lib/cloudconfig";
import { useActiveAuth, useConfigStore } from "@/lib/store";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const auth = useActiveAuth();
  const activeServerId = useConfigStore((state) => state.activeServerId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestEpochRef = useRef(0);
  const activeAuthFingerprint = auth
    ? `${auth.baseUrl}|${auth.clientId}|${auth.privateKeyPem}`
    : "";

  useEffect(() => {
    requestEpochRef.current += 1;
    setProjects([]);
    setMessage("");
    setError("");
    setLoading(false);
  }, [activeServerId, activeAuthFingerprint]);

  async function fetchProjects(requestEpoch: number) {
    const currentAuth = requireAuthConfig(auth);
    const response = await signedJsonRequest<Project[]>(
      currentAuth,
      "GET",
      "/admin/projects",
    );
    if (requestEpoch !== requestEpochRef.current) {
      return 0;
    }
    setProjects(response);
    return response.length;
  }

  async function refreshProjects() {
    await runWithFeedback(async (requestEpoch) => {
      const count = await fetchProjects(requestEpoch);
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setMessage(`Loaded ${count} projects.`);
    });
  }

  async function createProject() {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      if (!name.trim()) {
        throw new Error("Project name is required.");
      }
      await signedJsonRequest<Project>(currentAuth, "POST", "/admin/projects", {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setName("");
      setDescription("");
      const count = await fetchProjects(requestEpoch);
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setMessage(`Project created. Loaded ${count} projects.`);
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

  return (
    <ConsoleFrame
      title="Projects"
      description="Create and inspect CloudConfig projects."
    >
      <section className="border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Create project</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Project name</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              placeholder="e.g. cloudconfig-prod"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Unique name for grouping config keys and permissions.
            </span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Description</span>
            <textarea
              className="focus-ring min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              placeholder="Optional context for this project"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Helpful when multiple teams share one CloudConfig instance.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createProject}
              disabled={loading}
              className="focus-ring interactive rounded-md border border-emerald-700/80 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create project
            </button>
            <button
              type="button"
              onClick={refreshProjects}
              disabled={loading}
              className="focus-ring interactive rounded-md border border-zinc-600 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh list
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Project list</h2>
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
                <th className="py-2 text-xs uppercase tracking-wider text-zinc-500">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && projects.length === 0 ? (
                <LoadingSkeleton rows={3} colSpan={3} />
              ) : null}
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/50"
                >
                  <td className="py-2 pr-4">{project.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{project.id}</td>
                  <td className="py-2">
                    <span className="block max-w-[30ch] truncate text-zinc-300">
                      {project.description || "No description"}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && projects.length === 0 && (
                <tr>
                  <td className="py-4" colSpan={3}>
                    <EmptyState
                      icon={<FolderOpen className="size-5" weight="duotone" />}
                      title="No projects loaded"
                      description="Create your first project or refresh after selecting another server."
                      actionLabel="Refresh list"
                      onAction={refreshProjects}
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
