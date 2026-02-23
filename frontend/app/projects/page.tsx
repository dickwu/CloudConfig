"use client";

import { useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import { ensureAuthConfig, signedJsonRequest } from "@/lib/cloudconfig";
import { useAuthConfig } from "@/lib/useAuthConfig";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const { auth, setAuth } = useAuthConfig();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchProjects() {
    ensureAuthConfig(auth);
    const response = await signedJsonRequest<Project[]>(
      auth,
      "GET",
      "/admin/projects",
    );
    setProjects(response);
    return response.length;
  }

  async function refreshProjects() {
    await runWithFeedback(async () => {
      const count = await fetchProjects();
      setMessage(`Loaded ${count} projects.`);
    });
  }

  async function createProject() {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      if (!name.trim()) {
        throw new Error("Project name is required.");
      }
      await signedJsonRequest<Project>(auth, "POST", "/admin/projects", {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      const count = await fetchProjects();
      setMessage(`Project created. Loaded ${count} projects.`);
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
      title="Projects"
      description="Create and inspect CloudConfig projects."
      auth={auth}
      onAuthChange={setAuth}
    >
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Create project</h2>
        <div className="mt-3 grid gap-3">
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <textarea
            className="min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={createProject}
              disabled={loading}
              className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create
            </button>
            <button
              type="button"
              onClick={refreshProjects}
              disabled={loading}
              className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh list
            </button>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Project list</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-zinc-200">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-zinc-800">
                  <td className="py-2 pr-4">{project.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{project.id}</td>
                  <td className="py-2">{project.description || "—"}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td className="py-3 text-zinc-400" colSpan={3}>
                    No projects loaded yet.
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
