import Link from "next/link";
import { listUsers } from "@/lib/auth";
import { listInvoices } from "@/lib/facturas";
import { eur, fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();

  const [usuarios, facturas] = await Promise.all([listUsers(), listInvoices()]);

  // Total facturado (con IVA) por usuario, para la columna de la tabla.
  const totalPorUsuario = new Map<string, number>();
  for (const f of facturas) {
    const key = f.userId ?? `email:${f.clienteEmail}`;
    totalPorUsuario.set(key, (totalPorUsuario.get(key) ?? 0) + f.total);
  }

  const clientes = query
    ? usuarios.filter((u) =>
        `${u.nombre} ${u.apellidos} ${u.email} ${u.ciudad} ${u.telefono}`
          .toLowerCase()
          .includes(query)
      )
    : usuarios;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          Customers <span className="font-mono text-sm text-[var(--color-fg-muted)]">({clientes.length})</span>
        </h2>
        <form method="get" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, city…"
            className="w-64 max-w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-2 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Search
          </button>
        </form>
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">
          {query ? "No customer matches the search." : "No registered customers yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-4 py-3 mono-label text-[0.6rem]">Customer</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">Location</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">Joined</th>
                <th className="px-4 py-3 mono-label text-[0.6rem] text-right">Invoiced</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const total =
                  (totalPorUsuario.get(c.id) ?? 0) +
                  (totalPorUsuario.get(`email:${c.email}`) ?? 0);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-fg)]">
                        {c.nombre} {c.apellidos}
                      </p>
                      <p className="text-xs text-[var(--color-fg-muted)]">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fg-muted)]">
                      {c.ciudad || "—"}
                      {c.pais ? `, ${c.pais}` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                      {fmtDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{eur(total, 2)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="text-xs text-[var(--color-accent)] hover:underline"
                      >
                        View profile →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
