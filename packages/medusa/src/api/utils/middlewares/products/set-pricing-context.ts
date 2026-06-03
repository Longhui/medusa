import {
  AuthenticatedMedusaRequest,
  refetchEntities,
  refetchEntity,
} from "@medusajs/framework/http"
import { MedusaPricingContext } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { NextFunction } from "express"
import { DEFAULT_PRICE_FIELD_PATHS } from "./constants"

type PricingContextOptions = {
  priceFieldPaths?: string[]
}

// Internal symbol used to share the fetched region entity across the middleware chain,
// avoiding redundant DB queries (e.g. setTaxContext re-fetches the same region).
const REGION_CACHE = Symbol("medusa:region")

export function setPricingContext(options: PricingContextOptions = {}) {
  const { priceFieldPaths = DEFAULT_PRICE_FIELD_PATHS } = options

  return async (req: AuthenticatedMedusaRequest, _, next: NextFunction) => {
    const withCalculatedPrice = req.queryConfig.fields.some((field) =>
      priceFieldPaths.some(
        (pricePath) => field === pricePath || field.startsWith(`${pricePath}.`)
      )
    )
    if (!withCalculatedPrice) {
      return next()
    }

    // We validate the region ID in the previous middleware
    const region = await refetchEntity({
      entity: "region",
      idOrFilter: req.filterableFields.region_id!,
      scope: req.scope,
      // Fetch automatic_taxes here so setTaxContext can reuse cached data
      // instead of querying the region a second time.
      fields: ["id", "currency_code", "automatic_taxes"],
      options: {
        cache: {
          enable: true,
        },
      },
    })

    if (!region) {
      try {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Region with id ${req.filterableFields.region_id} not found when populating the pricing context`
        )
      } catch (e) {
        return next(e)
      }
    }

    // Cache the full region entity for downstream middleware (setTaxContext)
    // to reuse, eliminating a redundant DB round-trip.
    ;(req as any)[REGION_CACHE] = region

    const pricingContext: MedusaPricingContext = {
      region_id: region.id,
      currency_code: region.currency_code,
    }

    // Find all the customer groups the customer is a part of and set
    if (req.auth_context?.actor_id) {
      const { data: customerGroups } = await refetchEntities({
        entity: "customer_group",
        idOrFilter: { customers: { id: req.auth_context.actor_id } },
        scope: req.scope,
        fields: ["id"],
      })

      pricingContext.customer = { groups: [] }
      customerGroups.map((cg) =>
        pricingContext.customer?.groups?.push({ id: cg.id })
      )
    }

    req.pricingContext = pricingContext
    return next()
  }
}

/**
 * Read the region entity cached by setPricingContext (if available),
 * avoiding a redundant DB query in downstream middleware.
 */
export function getCachedRegion(req: any): { id: string; currency_code?: string; automatic_taxes?: boolean } | undefined {
  return req[REGION_CACHE]
}
