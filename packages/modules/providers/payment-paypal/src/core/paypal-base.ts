import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  ContainerRegistrationKeys,
  isDefined,
  isPresent,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} from "@paypal/paypal-server-sdk"
import { PayPalOptions, PayPalOrderStatus } from "../types"
import {
  fromPayPalAmount,
  toPayPalAmount,
} from "../utils/get-smallest-unit"
import { verifyWebhookSignature } from "../utils/webhook-utils"

abstract class PayPalBase extends AbstractPaymentProvider<PayPalOptions> {
  protected readonly options_: PayPalOptions
  protected container_: Record<string, unknown>

  static validateOptions(options: PayPalOptions): void {
    if (!isDefined(options.clientId)) {
      throw new Error("Required option `clientId` is missing in PayPal plugin")
    }
    if (!isDefined(options.clientSecret)) {
      throw new Error(
        "Required option `clientSecret` is missing in PayPal plugin"
      )
    }
    if (!isDefined(options.webhookId)) {
      throw new Error("Required option `webhookId` is missing in PayPal plugin")
    }
  }

  protected constructor(
    cradle: Record<string, unknown>,
    options: PayPalOptions
  ) {
    // @ts-ignore
    super(...arguments)

    this.container_ = cradle
    this.options_ = options
  }

  private createClient(clientId: string, clientSecret: string): Client {
    return new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      timeout: 0,
      environment: this.options_.sandbox
        ? Environment.Sandbox
        : Environment.Production,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
      },
    })
  }

  private getOrdersController(clientId: string, clientSecret: string) {
    const client = this.createClient(clientId, clientSecret)
    return new OrdersController(client)
  }

  private getPaymentsController(clientId: string, clientSecret: string) {
    const client = this.createClient(clientId, clientSecret)
    return new PaymentsController(client)
  }

  /**
   * Read runtime config from DB and merge with static options.
   * DB config takes precedence over static config.
   */
  protected async getEffectiveOptions(): Promise<PayPalOptions> {
    try {
      const query = this.container_[ContainerRegistrationKeys.QUERY] as any
      const { data } = await query.graph({
        entity: "payment_provider",
        fields: ["data"],
        filters: {
          id: `pp_paypal_${this.getIdentifier()}`,
        },
      })
      const dbConfig = (data?.[0]?.data || {}) as Partial<PayPalOptions>
      return { ...this.options_, ...dbConfig }
    } catch {
      return this.options_
    }
  }

  private getStatus(
    status: PayPalOrderStatus
  ): { status: PaymentSessionStatus } {
    switch (status) {
      case "CREATED":
      case "SAVED":
        return { status: PaymentSessionStatus.PENDING }
      case "APPROVED":
        return { status: PaymentSessionStatus.AUTHORIZED }
      case "COMPLETED":
        return { status: PaymentSessionStatus.CAPTURED }
      case "VOIDED":
        return { status: PaymentSessionStatus.CANCELED }
      case "PAYER_ACTION_REQUIRED":
        return { status: PaymentSessionStatus.REQUIRES_MORE }
      default:
        return { status: PaymentSessionStatus.PENDING }
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const options = await this.getEffectiveOptions()
    const ordersController = this.getOrdersController(
      options.clientId,
      options.clientSecret
    )

    const id = input?.data?.id as string
    if (!id) {
      throw this.buildError(
        "No PayPal order ID provided while getting payment status",
        new Error("No order ID provided")
      )
    }

    const { result: order } = await ordersController.getOrder({ id })
    const statusResponse = this.getStatus(order.status as PayPalOrderStatus)

    return statusResponse as unknown as GetPaymentStatusOutput
  }

  async initiatePayment({
    currency_code,
    amount,
    data,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const options = await this.getEffectiveOptions()
    const ordersController = this.getOrdersController(
      options.clientId,
      options.clientSecret
    )

    const paypalAmount = toPayPalAmount(Number(amount), currency_code)

    const { result: order } = await ordersController.createOrder({
      body: {
        intent: options.capture
          ? CheckoutPaymentIntent.Capture
          : CheckoutPaymentIntent.Authorize,
        purchaseUnits: [
          {
            amount: {
              currencyCode: currency_code.toUpperCase(),
              value: paypalAmount,
            },
            customId: (data?.session_id as string) ?? "",
            description:
              (data?.payment_description as string) ??
              options.paymentDescription,
          },
        ],
      },
    })

    const approveLink = (order.links ?? []).find(
      (l) => l.rel === "approve"
    )?.href

    return {
      id: order.id!,
      ...(this.getStatus(
        order.status as PayPalOrderStatus
      ) as unknown as Pick<InitiatePaymentOutput, "data" | "status">),
      data: {
        id: order.id,
        status: order.status,
        approve_link: approveLink,
        ...order,
      } as Record<string, unknown>,
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    return this.getPaymentStatus(input)
  }

  async cancelPayment({
    data,
  }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // PayPal does not provide a simple cancel/void endpoint for unapproved orders.
    // Approved authorizations can be voided, but for simplicity we just return
    // the existing data and let Medusa mark the session as cancelled.
    // Uncaptured authorizations will expire per PayPal's policy (typically 30 days).
    return { data }
  }

  async capturePayment({
    data,
  }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const options = await this.getEffectiveOptions()
    const ordersController = this.getOrdersController(
      options.clientId,
      options.clientSecret
    )

    const orderId = data?.id as string
    if (!orderId) {
      throw this.buildError(
        "No PayPal order ID provided while capturing payment",
        new Error("No order ID provided")
      )
    }

    try {
      const { result: capture } = await ordersController.captureOrder({
        id: orderId,
      })

      const captureId =
        (capture.purchaseUnits?.[0]?.payments?.captures?.[0]?.id as
          | string
          | undefined) ?? ""

      return {
        data: {
          ...capture,
          capture_id: captureId,
        } as Record<string, unknown>,
      }
    } catch (error: any) {
      if (
        error?.result?.details?.[0]?.issue?.includes("ORDER_ALREADY_CAPTURED")
      ) {
        return { data: data }
      }
      throw this.buildError("An error occurred in capturePayment", error)
    }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return await this.cancelPayment(input)
  }

  async refundPayment({
    amount,
    data,
  }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const options = await this.getEffectiveOptions()
    const paymentsController = this.getPaymentsController(
      options.clientId,
      options.clientSecret
    )

    const captureId = data?.capture_id as string
    if (!captureId) {
      throw this.buildError(
        "No capture ID provided while refunding payment",
        new Error("No capture ID provided")
      )
    }

    const currencyCode = data?.currency_code as string
    const paypalAmount = toPayPalAmount(Number(amount), currencyCode)

    try {
      await paymentsController.refundCapturedPayment({
        captureId,
        body: {
          amount: {
            currencyCode: currencyCode.toUpperCase(),
            value: paypalAmount,
          },
        },
      })
    } catch (e: any) {
      if (
        e?.result?.details?.[0]?.issue?.includes("REFUND_ALREADY_PROCESSED")
      ) {
        return { data }
      }
      throw this.buildError("An error occurred in refundPayment", e)
    }

    return { data }
  }

  async retrievePayment({
    data,
  }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const options = await this.getEffectiveOptions()
    const ordersController = this.getOrdersController(
      options.clientId,
      options.clientSecret
    )

    const id = data?.id as string
    if (!id) {
      throw this.buildError(
        "No PayPal order ID provided while retrieving payment",
        new Error("No order ID provided")
      )
    }

    try {
      const { result: order } = await ordersController.getOrder({ id })

      order.purchaseUnits?.forEach((unit) => {
        const a = unit.amount
        if (a?.value && a.currencyCode) {
          a.value = String(
            fromPayPalAmount(a.value, a.currencyCode)
          )
        }
      })

      return { data: order as unknown as Record<string, unknown> }
    } catch (e) {
      throw this.buildError("An error occurred in retrievePayment", e)
    }
  }

  async updatePayment({
    data,
  }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // PayPal does not support updating order amounts after creation.
    // Return current status to indicate no change.
    if (isPresent(data?.id)) {
      return this.getStatus(
        (data?.status as PayPalOrderStatus) ?? "CREATED"
      ) as unknown as UpdatePaymentOutput
    }

    return this.getStatus("CREATED") as unknown as UpdatePaymentOutput
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const options = await this.getEffectiveOptions()

    // Verify webhook signature
    const accessToken = await this.getAccessToken(
      options.clientId,
      options.clientSecret
    )
    const isValid = await verifyWebhookSignature(
      options.webhookId,
      accessToken,
      payload,
      options.sandbox
    )

    if (!isValid) {
      return { action: PaymentActions.FAILED, data: { session_id: "", amount: 0 } }
    }

    const eventBody = payload.data as Record<string, any>
    const resource = eventBody?.resource ?? {}
    const purchaseUnits = resource?.purchase_units ?? []
    const customId =
      purchaseUnits[0]?.custom_id ?? resource?.custom_id ?? ""

    const webhookAmount = resource?.amount?.value
      ? fromPayPalAmount(
          resource.amount.value,
          resource.amount.currency_code ?? "USD"
        )
      : 0

    switch (eventBody?.event_type) {
      case "CHECKOUT.ORDER.APPROVED":
        return {
          action: PaymentActions.AUTHORIZED,
          data: { session_id: customId, amount: webhookAmount },
        }
      case "PAYMENT.CAPTURE.COMPLETED":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: customId,
            amount: webhookAmount,
          },
        }
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED":
        return {
          action: PaymentActions.FAILED,
          data: { session_id: customId, amount: webhookAmount },
        }
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.CAPTURE.REVERSED":
        return {
          action: PaymentActions.CANCELED,
          data: { session_id: customId, amount: webhookAmount },
        }
      case "PAYMENT.CAPTURE.PENDING":
        return {
          action: PaymentActions.PENDING,
          data: { session_id: customId, amount: webhookAmount },
        }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }

  private async getAccessToken(
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    const baseUrl = this.options_.sandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com"

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    })

    if (!response.ok) {
      throw new Error(
        `Failed to get PayPal access token: ${response.statusText}`
      )
    }

    const data = await response.json()
    return data.access_token
  }

  protected buildError(message: string, error: Error): Error {
    return new Error(`${message}: ${error.message}`)
  }
}

export default PayPalBase
