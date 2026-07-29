import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  maskSecret,
  readSettings,
  stripeMode,
  WEBHOOK_EVENTS,
  WEBHOOK_URL,
} from "@/lib/ajustes";
import { StripeSettingsForm } from "@/components/admin/StripeSettingsForm";
import { ProviderSettingsForm } from "@/components/admin/ProviderSettingsForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  // Al cliente solo viaja la versión enmascarada: los secretos no salen de aquí.
  const { stripe, provider } = await readSettings();
  const initial = {
    enabled: stripe.enabled,
    hasSecretKey: !!stripe.secretKey,
    secretKeyMask: maskSecret(stripe.secretKey),
    hasWebhookSecret: !!stripe.webhookSecret,
    webhookSecretMask: maskSecret(stripe.webhookSecret),
    mode: stripeMode(stripe.secretKey),
  };
  const initialProvider = {
    enabled: provider.enabled,
    apiUrl: provider.apiUrl,
    hasToken: !!provider.token,
    tokenMask: maskSecret(provider.token),
  };

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("settings.subtitle")}</p>
      </header>

      <StripeSettingsForm
        initial={initial}
        webhookUrl={WEBHOOK_URL}
        webhookEvents={WEBHOOK_EVENTS}
      />

      <ProviderSettingsForm initial={initialProvider} />
    </div>
  );
}
