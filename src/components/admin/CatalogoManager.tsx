"use client";

import { cloneElement, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input, Label, Select, Textarea } from "@/components/forms/Field";
import { eurPrecio } from "@/lib/utils";
import type { Catalogo, Categoria, Producto, Texto, Ubicacion } from "@/lib/catalogo/store";

/** Los idiomas del sitio. Se repiten aquí porque el almacén vive en el
 *  servidor (usa `node:fs`) y de él solo pueden entrar tipos. */
const IDIOMAS = ["en", "es", "fr"] as const;

/**
 * Gestión del catálogo: categorías, productos y ubicaciones.
 *
 * Todo en una pantalla y editando en el sitio (el formulario se abre debajo de
 * la fila que se toca) en lugar de navegar a un detalle por entidad: son pocas
 * fichas y lo normal es venir a cambiar un precio o una descripción, no a dar
 * de alta una línea entera.
 *
 * Cada guardado revalida el sitio público en el servidor (ver la ruta
 * `/api/admin/catalogo`) y aquí se pide un `router.refresh()` para repintar la
 * lista con lo que el almacén haya decidido (el slug, por ejemplo, se
 * normaliza y se desduplica al guardar).
 */

type Abierto =
  | { tipo: "categoria"; id: string | null }
  | { tipo: "producto"; id: string | null; categoriaId: string }
  | { tipo: "ubicacion"; id: string | null }
  | null;

const TEXTO_VACIO: Texto = { en: "", es: "", fr: "" };

/** Códigos que devuelve `/api/admin/catalogo` y que sabemos traducir. */
const ERRORES: string[] = [
  "datos",
  "no-encontrado",
  "categoria-con-productos",
  "categoria-vps-protegida",
];

export function CatalogoManager({ catalogo }: { catalogo: Catalogo }) {
  const t = useTranslations("admin");
  const router = useRouter();

  const [abierto, setAbierto] = useState<Abierto>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorias = [...catalogo.categorias].sort((a, b) => a.orden - b.orden);
  const ubicaciones = [...catalogo.ubicaciones].sort((a, b) => a.orden - b.orden);
  const productosDe = (categoriaId: string) =>
    catalogo.productos.filter((p) => p.categoriaId === categoriaId).sort((a, b) => a.orden - b.orden);

  async function enviar(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        // El almacén devuelve un código ("categoria-con-productos"…); cualquier
        // otra cosa cae en el mensaje genérico.
        const codigo = typeof json?.error === "string" ? json.error : "";
        setError(t(`catalog.errors.${ERRORES.includes(codigo) ? codigo : "generico"}`));
        return false;
      }
      setAbierto(null);
      router.refresh();
      return true;
    } catch {
      setError(t("catalog.errors.conexion"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function borrar(entidad: string, id: string, aviso: string) {
    if (!confirm(aviso)) return;
    await enviar({ entidad, accion: "borrar", id });
  }

  const esteAbierto = (tipo: string, id: string | null) =>
    abierto?.tipo === tipo && abierto.id === id;

  return (
    <div className="grid gap-10">
      <header>
        <h1 className="text-2xl font-semibold">{t("catalog.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("catalog.subtitle")}</p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* ------------------------------ Categorías ------------------------- */}
      <Bloque
        titulo={t("catalog.categories.title")}
        descripcion={t("catalog.categories.hint")}
        accion={
          <BotonAnadir
            label={t("catalog.categories.add")}
            onClick={() => setAbierto({ tipo: "categoria", id: null })}
          />
        }
      >
        {esteAbierto("categoria", null) && (
          <CategoriaForm
            categoria={null}
            busy={busy}
            onCancel={() => setAbierto(null)}
            onSave={(datos) => enviar({ entidad: "categoria", accion: "crear", datos })}
          />
        )}

        <ul className="grid gap-3">
          {categorias.map((c) => {
            const productos = productosDe(c.id);
            const ruta = c.tipo === "vps" ? "/vps" : `/dedicados/${c.slug}`;
            return (
              <li
                key={c.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {c.nombre.en || "—"}
                      {!c.visible && <Etiqueta>{t("catalog.hidden")}</Etiqueta>}
                      {c.tipo === "vps" && <Etiqueta>{t("catalog.categories.vpsBadge")}</Etiqueta>}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
                      {ruta} · {t("catalog.categories.count", { count: productos.length })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BotonMenor
                      onClick={() =>
                        setAbierto(esteAbierto("categoria", c.id) ? null : { tipo: "categoria", id: c.id })
                      }
                    >
                      {t("catalog.edit")}
                    </BotonMenor>
                    <BotonMenor
                      peligro
                      disabled={busy || c.tipo === "vps"}
                      onClick={() => borrar("categoria", c.id, t("catalog.categories.confirmDelete"))}
                    >
                      {t("catalog.delete")}
                    </BotonMenor>
                  </div>
                </div>

                {esteAbierto("categoria", c.id) && (
                  <CategoriaForm
                    categoria={c}
                    busy={busy}
                    onCancel={() => setAbierto(null)}
                    onSave={(datos) =>
                      enviar({ entidad: "categoria", accion: "actualizar", id: c.id, datos })
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Bloque>

      {/* ------------------------------- Productos ------------------------- */}
      <Bloque titulo={t("catalog.products.title")} descripcion={t("catalog.products.hint")}>
        <div className="grid gap-6">
          {categorias.map((c) => {
            const productos = productosDe(c.id);
            return (
              <section key={c.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="mono-label text-[0.6rem]">{c.nombre.en || c.slug}</h3>
                  <BotonAnadir
                    label={t("catalog.products.add")}
                    onClick={() => setAbierto({ tipo: "producto", id: null, categoriaId: c.id })}
                  />
                </div>

                {abierto?.tipo === "producto" &&
                  abierto.id === null &&
                  abierto.categoriaId === c.id && (
                    <ProductoForm
                      producto={null}
                      categoriaId={c.id}
                      categorias={categorias}
                      busy={busy}
                      onCancel={() => setAbierto(null)}
                      onSave={(datos) => enviar({ entidad: "producto", accion: "crear", datos })}
                    />
                  )}

                {productos.length === 0 ? (
                  <p className="text-sm text-[var(--color-fg-muted)]">{t("catalog.products.empty")}</p>
                ) : (
                  <ul className="grid gap-2">
                    {productos.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              {p.nombre}
                              {p.popular && <Etiqueta>{t("catalog.products.popular")}</Etiqueta>}
                              {!p.visible && <Etiqueta>{t("catalog.hidden")}</Etiqueta>}
                            </p>
                            <p className="mt-1 break-words font-mono text-xs text-[var(--color-fg-muted)]">
                              {[p.cpu, p.ram, p.almacenamiento].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-sm">{eurPrecio(p.precio)}</span>
                            <BotonMenor
                              onClick={() =>
                                setAbierto(
                                  esteAbierto("producto", p.id)
                                    ? null
                                    : { tipo: "producto", id: p.id, categoriaId: p.categoriaId }
                                )
                              }
                            >
                              {t("catalog.edit")}
                            </BotonMenor>
                            <BotonMenor
                              peligro
                              disabled={busy}
                              onClick={() =>
                                borrar("producto", p.id, t("catalog.products.confirmDelete"))
                              }
                            >
                              {t("catalog.delete")}
                            </BotonMenor>
                          </div>
                        </div>

                        {esteAbierto("producto", p.id) && (
                          <ProductoForm
                            producto={p}
                            categoriaId={p.categoriaId}
                            categorias={categorias}
                            busy={busy}
                            onCancel={() => setAbierto(null)}
                            onSave={(datos) =>
                              enviar({ entidad: "producto", accion: "actualizar", id: p.id, datos })
                            }
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </Bloque>

      {/* ------------------------------ Ubicaciones ------------------------ */}
      <Bloque
        titulo={t("catalog.locations.title")}
        descripcion={t("catalog.locations.hint")}
        accion={
          <BotonAnadir
            label={t("catalog.locations.add")}
            onClick={() => setAbierto({ tipo: "ubicacion", id: null })}
          />
        }
      >
        {esteAbierto("ubicacion", null) && (
          <UbicacionForm
            ubicacion={null}
            busy={busy}
            onCancel={() => setAbierto(null)}
            onSave={(datos) => enviar({ entidad: "ubicacion", accion: "crear", datos })}
          />
        )}

        <ul className="grid gap-2">
          {ubicaciones.map((u) => (
            <li
              key={u.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span aria-hidden="true">{u.bandera}</span>
                    {u.nombre.en || "—"}
                    {!u.visible && <Etiqueta>{t("catalog.hidden")}</Etiqueta>}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
                    /vps/{u.slug} · {u.ciudad.en}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm">{eurPrecio(u.precioDesde)}</span>
                  <BotonMenor
                    onClick={() =>
                      setAbierto(esteAbierto("ubicacion", u.id) ? null : { tipo: "ubicacion", id: u.id })
                    }
                  >
                    {t("catalog.edit")}
                  </BotonMenor>
                  <BotonMenor
                    peligro
                    disabled={busy}
                    onClick={() => borrar("ubicacion", u.id, t("catalog.locations.confirmDelete"))}
                  >
                    {t("catalog.delete")}
                  </BotonMenor>
                </div>
              </div>

              {esteAbierto("ubicacion", u.id) && (
                <UbicacionForm
                  ubicacion={u}
                  busy={busy}
                  onCancel={() => setAbierto(null)}
                  onSave={(datos) =>
                    enviar({ entidad: "ubicacion", accion: "actualizar", id: u.id, datos })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </Bloque>
    </div>
  );
}

/* ------------------------------- Formularios ------------------------------ */

type FormProps = {
  busy: boolean;
  onCancel: () => void;
  onSave: (datos: Record<string, unknown>) => Promise<boolean>;
};

function CategoriaForm({ categoria, busy, onCancel, onSave }: FormProps & { categoria: Categoria | null }) {
  const t = useTranslations("admin");
  const [nombre, setNombre] = useState<Texto>(categoria?.nombre ?? TEXTO_VACIO);
  const [descripcion, setDescripcion] = useState<Texto>(categoria?.descripcion ?? TEXTO_VACIO);
  const [etiqueta, setEtiqueta] = useState<Texto>(categoria?.etiqueta ?? TEXTO_VACIO);
  const [slug, setSlug] = useState(categoria?.slug ?? "");
  const [visible, setVisible] = useState(categoria?.visible ?? true);
  const [orden, setOrden] = useState(String(categoria?.orden ?? 0));

  const esVps = categoria?.tipo === "vps";

  return (
    <Panel>
      <CampoTexto label={t("catalog.form.name")} requerido valor={nombre} onChange={setNombre} />
      <CampoTexto
        label={t("catalog.form.description")}
        valor={descripcion}
        onChange={setDescripcion}
        multilinea
      />
      <CampoTexto
        label={t("catalog.form.badge")}
        ayuda={t("catalog.form.badgeHint")}
        valor={etiqueta}
        onChange={setEtiqueta}
      />
      {!esVps && (
        <Campo label={t("catalog.form.slug")} ayuda={t("catalog.form.slugHint")}>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={48} />
        </Campo>
      )}
      <Fila2>
        <Campo label={t("catalog.form.order")}>
          <Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </Campo>
        <Casilla label={t("catalog.form.visible")} checked={visible} onChange={setVisible} />
      </Fila2>

      <Acciones
        busy={busy}
        onCancel={onCancel}
        onSave={() => onSave({ nombre, descripcion, etiqueta, slug, visible, orden: Number(orden) })}
        puedeGuardar={nombre.en.trim().length > 0}
      />
    </Panel>
  );
}

function ProductoForm({
  producto,
  categoriaId,
  categorias,
  busy,
  onCancel,
  onSave,
}: FormProps & {
  producto: Producto | null;
  categoriaId: string;
  categorias: Categoria[];
}) {
  const t = useTranslations("admin");
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoria, setCategoria] = useState(producto?.categoriaId ?? categoriaId);
  const [cpu, setCpu] = useState(producto?.cpu ?? "");
  const [ram, setRam] = useState(producto?.ram ?? "");
  const [almacenamiento, setAlmacenamiento] = useState(producto?.almacenamiento ?? "");
  const [red, setRed] = useState(producto?.red ?? "");
  const [precio, setPrecio] = useState(String(producto?.precio ?? ""));
  const [popular, setPopular] = useState(producto?.popular ?? false);
  const [visible, setVisible] = useState(producto?.visible ?? true);
  const [orden, setOrden] = useState(String(producto?.orden ?? 0));

  return (
    <Panel>
      <Fila2>
        <Campo label={t("catalog.form.name")} requerido>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
        </Campo>
        <Campo label={t("catalog.form.category")}>
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre.en || c.slug}
              </option>
            ))}
          </Select>
        </Campo>
      </Fila2>

      <Fila2>
        <Campo label={t("catalog.form.cpu")}>
          <Input value={cpu} onChange={(e) => setCpu(e.target.value)} maxLength={120} />
        </Campo>
        <Campo label={t("catalog.form.ram")}>
          <Input value={ram} onChange={(e) => setRam(e.target.value)} maxLength={120} />
        </Campo>
      </Fila2>
      <Fila2>
        <Campo label={t("catalog.form.storage")}>
          <Input
            value={almacenamiento}
            onChange={(e) => setAlmacenamiento(e.target.value)}
            maxLength={120}
          />
        </Campo>
        <Campo label={t("catalog.form.network")}>
          <Input value={red} onChange={(e) => setRed(e.target.value)} maxLength={120} />
        </Campo>
      </Fila2>

      <Fila2>
        <Campo label={t("catalog.form.price")} ayuda={t("catalog.form.priceHint")}>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </Campo>
        <Campo label={t("catalog.form.order")}>
          <Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </Campo>
      </Fila2>

      <Fila2>
        <Casilla label={t("catalog.form.popular")} checked={popular} onChange={setPopular} />
        <Casilla label={t("catalog.form.visible")} checked={visible} onChange={setVisible} />
      </Fila2>

      {producto && (
        <p className="font-mono text-xs text-[var(--color-fg-dim)]">
          {t("catalog.form.planId", { id: producto.planId })}
        </p>
      )}

      <Acciones
        busy={busy}
        onCancel={onCancel}
        onSave={() =>
          onSave({
            nombre,
            categoriaId: categoria,
            cpu,
            ram,
            almacenamiento,
            red,
            precio: Number(precio),
            popular,
            visible,
            orden: Number(orden),
          })
        }
        puedeGuardar={nombre.trim().length > 0}
      />
    </Panel>
  );
}

function UbicacionForm({
  ubicacion,
  busy,
  onCancel,
  onSave,
}: FormProps & { ubicacion: Ubicacion | null }) {
  const t = useTranslations("admin");
  const [nombre, setNombre] = useState<Texto>(ubicacion?.nombre ?? TEXTO_VACIO);
  const [ciudad, setCiudad] = useState<Texto>(ubicacion?.ciudad ?? TEXTO_VACIO);
  const [nota, setNota] = useState<Texto>(ubicacion?.nota ?? TEXTO_VACIO);
  const [bandera, setBandera] = useState(ubicacion?.bandera ?? "");
  const [cpu, setCpu] = useState(ubicacion?.cpu ?? "");
  const [provisionLocation, setProvisionLocation] = useState(ubicacion?.provisionLocation ?? "");
  const [precioDesde, setPrecioDesde] = useState(String(ubicacion?.precioDesde ?? ""));
  const [slug, setSlug] = useState(ubicacion?.slug ?? "");
  const [mapX, setMapX] = useState(String(ubicacion?.mapX ?? 50));
  const [mapY, setMapY] = useState(String(ubicacion?.mapY ?? 50));
  const [visible, setVisible] = useState(ubicacion?.visible ?? true);
  const [orden, setOrden] = useState(String(ubicacion?.orden ?? 0));

  return (
    <Panel>
      <CampoTexto label={t("catalog.form.name")} requerido valor={nombre} onChange={setNombre} />
      <CampoTexto label={t("catalog.form.city")} valor={ciudad} onChange={setCiudad} />
      <CampoTexto
        label={t("catalog.form.note")}
        ayuda={t("catalog.form.noteHint")}
        valor={nota}
        onChange={setNota}
      />

      <Fila2>
        <Campo label={t("catalog.form.flag")} ayuda={t("catalog.form.flagHint")}>
          <Input value={bandera} onChange={(e) => setBandera(e.target.value)} maxLength={8} />
        </Campo>
        <Campo label={t("catalog.form.priceFrom")} ayuda={t("catalog.form.priceHint")}>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={precioDesde}
            onChange={(e) => setPrecioDesde(e.target.value)}
          />
        </Campo>
      </Fila2>

      <Campo label={t("catalog.form.slug")} ayuda={t("catalog.form.slugHint")}>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={48} />
      </Campo>

      <Fila2>
        <Campo label={t("catalog.form.regionCpu")} ayuda={t("catalog.form.regionCpuHint")}>
          <Input value={cpu} onChange={(e) => setCpu(e.target.value)} maxLength={60} />
        </Campo>
        <Campo
          label={t("catalog.form.provisionLocation")}
          ayuda={t("catalog.form.provisionLocationHint")}
        >
          <Input
            value={provisionLocation}
            onChange={(e) => setProvisionLocation(e.target.value)}
            maxLength={40}
          />
        </Campo>
      </Fila2>

      <Fila2>
        <Campo label={t("catalog.form.mapX")} ayuda={t("catalog.form.mapHint")}>
          <Input type="number" min="0" max="100" value={mapX} onChange={(e) => setMapX(e.target.value)} />
        </Campo>
        <Campo label={t("catalog.form.mapY")} ayuda={t("catalog.form.mapHint")}>
          <Input type="number" min="0" max="100" value={mapY} onChange={(e) => setMapY(e.target.value)} />
        </Campo>
      </Fila2>

      <Fila2>
        <Campo label={t("catalog.form.order")}>
          <Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </Campo>
        <Casilla label={t("catalog.form.visible")} checked={visible} onChange={setVisible} />
      </Fila2>

      <Acciones
        busy={busy}
        onCancel={onCancel}
        onSave={() =>
          onSave({
            nombre,
            ciudad,
            nota,
            bandera,
            cpu,
            provisionLocation,
            precioDesde: Number(precioDesde),
            slug,
            mapX: Number(mapX),
            mapY: Number(mapY),
            visible,
            orden: Number(orden),
          })
        }
        puedeGuardar={nombre.en.trim().length > 0}
      />
    </Panel>
  );
}

/* -------------------------------- Piezas UI ------------------------------- */

function Bloque({
  titulo,
  descripcion,
  accion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] pb-3">
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {descripcion && (
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{descripcion}</p>
          )}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] p-4">
      {children}
    </div>
  );
}

function Fila2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Campo({
  label,
  ayuda,
  requerido,
  children,
}: {
  label: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <Label htmlFor={id} required={requerido}>
        {label}
      </Label>
      {/* El control lo pone quien usa el campo; aquí solo se le cuelga el id
          para que la etiqueta lo señale. */}
      <Slot id={id}>{children}</Slot>
      {ayuda && <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">{ayuda}</p>}
    </div>
  );
}

function Slot({ id, children }: { id: string; children: React.ReactElement<{ id?: string }> }) {
  return cloneElement(children, { id });
}

/**
 * Campo multiidioma: un recuadro por idioma del sitio. Solo el inglés es
 * obligatorio; lo que se deje vacío se muestra en inglés.
 */
function CampoTexto({
  label,
  ayuda,
  requerido,
  multilinea,
  valor,
  onChange,
}: {
  label: string;
  ayuda?: string;
  requerido?: boolean;
  multilinea?: boolean;
  valor: Texto;
  onChange: (t: Texto) => void;
}) {
  const t = useTranslations("admin");
  return (
    <div className="min-w-0">
      <Label required={requerido}>{label}</Label>
      <div className="grid gap-2">
        {IDIOMAS.map((l) => (
          <div key={l} className="flex items-start gap-2">
            <span className="mt-3 w-7 shrink-0 font-mono text-[0.65rem] uppercase text-[var(--color-fg-dim)]">
              {l}
            </span>
            {multilinea ? (
              <Textarea
                aria-label={`${label} (${l})`}
                value={valor[l]}
                onChange={(e) => onChange({ ...valor, [l]: e.target.value })}
                className="min-h-20"
                maxLength={400}
              />
            ) : (
              <Input
                aria-label={`${label} (${l})`}
                value={valor[l]}
                onChange={(e) => onChange({ ...valor, [l]: e.target.value })}
                maxLength={400}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">{ayuda ?? t("catalog.form.langHint")}</p>
    </div>
  );
}

function Casilla({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

function Acciones({
  busy,
  puedeGuardar,
  onCancel,
  onSave,
}: {
  busy: boolean;
  puedeGuardar: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("admin");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy || !puedeGuardar}
        onClick={onSave}
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-40"
      >
        {busy ? t("catalog.saving") : t("catalog.save")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] disabled:opacity-40"
      >
        {t("catalog.cancel")}
      </button>
    </div>
  );
}

function BotonAnadir({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 text-sm text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
    >
      + {label}
    </button>
  );
}

function BotonMenor({
  children,
  onClick,
  disabled,
  peligro,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center text-sm transition-colors disabled:opacity-30 ${
        peligro
          ? "text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
      }`}
    >
      {children}
    </button>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-[var(--color-line-strong)] px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--color-fg-muted)]">
      {children}
    </span>
  );
}
