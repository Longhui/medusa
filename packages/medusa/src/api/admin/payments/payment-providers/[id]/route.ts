import { HttpTypes } from "@medusajs/framework/types"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<HttpTypes.AdminPaymentProviderResponse>
) => {
  const paymentModuleService = req.scope.resolve(Modules.PAYMENT)

  const [payment_provider] = await paymentModuleService.listPaymentProviders({
    id: req.params.id,
  })

  if (!payment_provider) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Payment provider with id: ${req.params.id} was not found`
    )
  }

  res.json({ payment_provider })
}

export const PUT = async (
  req: AuthenticatedMedusaRequest<{ data?: Record<string, unknown> }>,
  res: MedusaResponse<HttpTypes.AdminPaymentProviderResponse>
) => {
  const paymentModuleService = req.scope.resolve(Modules.PAYMENT)

  const [payment_provider] = await paymentModuleService.updatePaymentProviders([
    {
      id: req.params.id,
      data: req.body.data,
    },
  ])

  res.json({ payment_provider })
}
