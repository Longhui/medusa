import { ProviderWebhookPayload } from "@medusajs/framework/types"

/**
 * PayPal webhook headers that are needed for signature verification.
 */
export interface PayPalWebhookHeaders {
  "paypal-auth-algo": string
  "paypal-cert-url": string
  "paypal-transmission-id": string
  "paypal-transmission-sig": string
  "paypal-transmission-time": string
}

export function extractPayPalWebhookHeaders(
  headers: Record<string, unknown>
): PayPalWebhookHeaders {
  return {
    "paypal-auth-algo": (headers["paypal-auth-algo"] ||
      headers["PAYPAL-AUTH-ALGO"]) as string,
    "paypal-cert-url": (headers["paypal-cert-url"] ||
      headers["PAYPAL-CERT-URL"]) as string,
    "paypal-transmission-id": (headers["paypal-transmission-id"] ||
      headers["PAYPAL-TRANSMISSION-ID"]) as string,
    "paypal-transmission-sig": (headers["paypal-transmission-sig"] ||
      headers["PAYPAL-TRANSMISSION-SIG"]) as string,
    "paypal-transmission-time": (headers["paypal-transmission-time"] ||
      headers["PAYPAL-TRANSMISSION-TIME"]) as string,
  }
}

/**
 * Verify a PayPal webhook signature by calling PayPal's verification endpoint.
 */
export async function verifyWebhookSignature(
  webhookId: string,
  accessToken: string,
  payload: ProviderWebhookPayload["payload"],
  sandbox: boolean = true
): Promise<boolean> {
  const headers = extractPayPalWebhookHeaders(payload.headers)
  const baseUrl = sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com"

  const body = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: payload.data,
  }

  const response = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    return false
  }

  const result = await response.json()
  return result.verification_status === "SUCCESS"
}
