import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  maskSecret,
  readSettings,
  stripeMode,
  tokenExpiresAt,
  WEBHOOK_EVENTS,
  WEBHOOK_URL,
} from "@/lib/ajustes";
import { StripeSettingsForm } from "@/components/admin/StripeSettingsForm";
import { ProviderSettingsForm } from "@/components/admin/ProviderSettingsForm";
import { AlertSettingsForm } from "@/components/admin/AlertSettingsForm";
import { WiseSettingsForm } from "@/components/admin/WiseSettingsForm";

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
  const { stripe, provider, alerts, wise } = await readSettings();
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
    tokenExpiresAt: provider.token
      ? (tokenExpiresAt(provider.token)?.toISOString() ?? null)
      : null,
  };
  const initialWise = {
    enabled: wise.enabled,
    sandbox: wise.sandbox,
    profileId: wise.profileId,
    balanceId: wise.balanceId,
    hasApiToken: !!wise.apiToken,
    apiTokenMask: maskSecret(wise.apiToken),
    hasPrivateKey: !!wise.privateKey,
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

      <WiseSettingsForm initial={initialWise} />

      <AlertSettingsForm initial={alerts} />
    </div>
  );
}
