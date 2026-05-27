export interface PayPalOptions {
  /**
   * The PayPal REST API Client ID
   */
  clientId: string
  /**
   * The PayPal REST API Client Secret
   */
  clientSecret: string
  /**
   * The Webhook ID used to verify webhook signatures
   */
  webhookId: string
  /**
   * Whether to use the Sandbox environment. Default true.
   */
  sandbox?: boolean
  /**
   * Whether to capture payment immediately (default false).
   * When false, the payment is authorized first and captured later.
   */
  capture?: boolean
  /**
   * Set a default description on the order if the context does not provide one
   */
  paymentDescription?: string
}

export const PaymentProviderKeys = {
  PAYPAL: "paypal",
}

export type PayPalOrderStatus =
  | "CREATED"
  | "SAVED"
  | "APPROVED"
  | "VOIDED"
  | "COMPLETED"
  | "PAYER_ACTION_REQUIRED"

export const ErrorCodes = {
  ORDER_ALREADY_CAPTURED: "ORDER_ALREADY_CAPTURED",
  ORDER_ALREADY_VOIDED: "ORDER_ALREADY_VOIDED",
  REFUND_ALREADY_PROCESSED: "REFUND_ALREADY_PROCESSED",
}
