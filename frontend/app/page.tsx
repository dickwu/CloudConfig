import Link from "next/link";

const cards = [
  {
    href: "/clients",
    title: "Clients",
    description: "Create, list, and delete API clients.",
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Create projects and inspect project metadata.",
  },
  {
    href: "/configs",
    title: "Configs",
    description: "Upsert and read project config values.",
  },
  {
    href: "/permissions",
    title: "Permissions",
    description: "Grant or revoke client access to projects.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="text-3xl font-semibold text-zinc-100">
          CloudConfig Management Console
        </h1>
        <p className="mt-2 text-zinc-300">
          Manage clients, projects, config keys, and permissions from a static
          Next.js frontend embedded into the Rust binary.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            <h2 className="text-xl font-medium text-zinc-100">{card.title}</h2>
            <p className="mt-2 text-sm text-zinc-300">{card.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
