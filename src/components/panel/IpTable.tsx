import { useTranslations } from "next-intl";
import type { ServiceIp } from "@/lib/panel/types";
import { CARD, SECTION_INDEX } from "./ui";

/**
 * Tabla de IPs: dirección, MAC, máscara y puerta de enlace, tanto IPv4 como
 * IPv6. En móvil la tabla desborda dentro de su propio contenedor con scroll
 * horizontal (el cuerpo de la página nunca hace scroll lateral).
 */
export function IpTable({ ips }: { ips: ServiceIp[] }) {
  const t = useTranslations("panel");
  return (
    <section id="ips" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/05</p>
        <h2 className="mt-2 text-lg font-semibold">{t("ips.heading")}</h2>
      </div>

      {ips.length === 0 ? (
        <p className="px-6 py-6 text-sm text-[var(--color-fg-dim)]">{t("ips.none")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-t border-[var(--color-line)] text-left">
                {["version", "address", "mac", "netmask", "gateway"].map((col) => (
                  <th key={col} className="px-6 py-3 mono-label text-[0.6rem] font-normal">
                    {t(`ips.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ips.map((ip) => (
                <tr key={ip.address} className="border-t border-[var(--color-line)]">
                  <td className="px-6 py-3">
                    <span className="rounded-full border border-[var(--color-line-strong)] px-2 py-0.5 font-mono text-xs text-[var(--color-fg-muted)]">
                      {ip.version === 4 ? t("ips.v4") : t("ips.v6")}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono break-all text-[var(--color-fg)]">{ip.address}</td>
                  <td className="px-6 py-3 font-mono text-[var(--color-fg-muted)]">{ip.mac}</td>
                  <td className="px-6 py-3 font-mono text-[var(--color-fg-muted)]">{ip.netmask}</td>
                  <td className="px-6 py-3 font-mono text-[var(--color-fg-muted)]">{ip.gateway}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
