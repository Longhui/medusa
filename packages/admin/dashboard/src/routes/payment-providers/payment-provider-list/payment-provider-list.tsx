import { InformationCircle, ToolsSolid } from "@medusajs/icons"
import {
  Container,
  Heading,
  Input,
  Label,
  Text,
  Tooltip,
  Button,
  Switch,
} from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { usePaymentProviders, useUpdatePaymentProvider } from "../../../hooks/api/payments"
import { useState } from "react"

type ProviderConfig = {
  clientId?: string
  clientSecret?: string
  webhookId?: string
  sandbox?: boolean
  capture?: boolean
}

export const PaymentProviderList = () => {
  const { t } = useTranslation()
  const { payment_providers, isPending, isError, error } = usePaymentProviders(
    { fields: "id,is_enabled,data" },
    {}
  )

  if (isPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Text>{t("app.nav.settings.header")}...</Text>
      </div>
    )
  }

  if (isError) {
    throw error
  }

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-col gap-x-4 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <ToolsSolid />
          <Heading>{t("paymentProviders.domain")}</Heading>
        </div>
        <Text className="text-ui-fg-subtle">
          {t("paymentProviders.description")}
        </Text>
      </div>
      <div className="flex flex-col gap-y-3 px-6 pb-8">
        {payment_providers?.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  )
}

const ProviderCard = ({
  provider,
}: {
  provider: { id: string; is_enabled: boolean; data?: Record<string, unknown> | null }
}) => {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [config, setConfig] = useState<ProviderConfig>(
    (provider.data as ProviderConfig) || {}
  )
  const updateMutation = useUpdatePaymentProvider(provider.id)

  const handleSave = () => {
    updateMutation.mutate(
      { data: config as Record<string, unknown> },
      {
        onSuccess: () => setIsEditing(false),
      }
    )
  }

  const isPayPal = provider.id.includes("paypal")

  return (
    <Container className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Text size="large" weight="plus">
            {formatProviderName(provider.id)}
          </Text>
          <Text className="text-ui-fg-muted" size="small">
            ({provider.id})
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          {isEditing ? (
            <>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setIsEditing(false)}
              >
                {t("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={handleSave}
                isLoading={updateMutation.isPending}
              >
                {t("actions.save")}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="small"
              onClick={() => setIsEditing(true)}
            >
              {t("actions.edit")}
            </Button>
          )}
        </div>
      </div>
      {isPayPal && isEditing && (
        <div className="flex flex-col gap-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-2">
              <Label>{t("paymentProviders.fields.clientId")}</Label>
              <Input
                value={config.clientId || ""}
                onChange={(e) =>
                  setConfig({ ...config, clientId: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label>{t("paymentProviders.fields.clientSecret")}</Label>
              <Input
                type="password"
                value={config.clientSecret || ""}
                onChange={(e) =>
                  setConfig({ ...config, clientSecret: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label>{t("paymentProviders.fields.webhookId")}</Label>
              <Input
                value={config.webhookId || ""}
                onChange={(e) =>
                  setConfig({ ...config, webhookId: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-x-4">
            <div className="flex items-center gap-x-2">
              <Switch
                id="sandbox"
                checked={config.sandbox ?? true}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, sandbox: !!checked })
                }
              />
              <Label htmlFor="sandbox">
                {t("paymentProviders.fields.sandbox")}
              </Label>
              <Tooltip content={t("paymentProviders.tooltips.sandbox")}>
                <InformationCircle className="text-ui-fg-muted" />
              </Tooltip>
            </div>
            <div className="flex items-center gap-x-2">
              <Switch
                id="autoCapture"
                checked={config.capture ?? false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, capture: !!checked })
                }
              />
              <Label htmlFor="autoCapture">
                {t("paymentProviders.fields.autoCapture")}
              </Label>
              <Tooltip content={t("paymentProviders.tooltips.autoCapture")}>
                <InformationCircle className="text-ui-fg-muted" />
              </Tooltip>
            </div>
          </div>
        </div>
      )}
      {!isPayPal && isEditing && (
        <Text className="text-ui-fg-muted">
          {t("paymentProviders.noConfigAvailable")}
        </Text>
      )}
    </Container>
  )
}

const formatProviderName = (id: string) => {
  const parts = id.split("_")
  // id format: pp_{name}_{variant}
  const name = parts[1] || id
  return name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}
