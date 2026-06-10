import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CurrencyDollar } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Badge, Button, Container, Heading, Tooltip } from "@medusajs/ui"

import { ActionMenu } from "../../../../../components/common/action-menu"
import { NoRecords } from "../../../../../components/common/empty-table-content"
import { getLocaleAmount } from "../../../../../lib/money-amount-helpers"

type VariantPricesSectionProps = {
  variant: Omit<HttpTypes.AdminProductVariant, "prices"> & {
    prices?: (HttpTypes.AdminPrice & {
      rules?: Record<string, unknown>
    })[]
  }
}

export function VariantPricesSection({ variant }: VariantPricesSectionProps) {
  const { t } = useTranslation()

  const allPrices = useMemo(() => {
    if (!variant.prices?.length) return []

    // Separate base prices (no rules) from rule-specific prices
    const basePrices = variant.prices.filter(
      (p) => !Object.keys(p.rules || {}).length
    )
    const rulePrices = variant.prices.filter(
      (p) => Object.keys(p.rules || {}).length > 0
    )

    return [
      ...basePrices.sort((p1, p2) =>
        p1.currency_code?.localeCompare(p2.currency_code)
      ),
      ...rulePrices.sort((p1, p2) =>
        p1.currency_code?.localeCompare(p2.currency_code)
      ),
    ]
  }, [variant.prices])

  const hasPrices = !!allPrices.length
  const [pageSize, setPageSize] = useState(3)
  const displayPrices = allPrices.slice(0, pageSize)

  const onShowMore = () => {
    setPageSize(pageSize + 3)
  }

  return (
    <Container className="flex flex-col divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("labels.prices")}</Heading>
        <ActionMenu
          groups={[
            {
              actions: [
                {
                  label: t("actions.edit"),
                  to: `/products/${variant.product_id}/variants/${variant.id}/prices`,
                  icon: <CurrencyDollar />,
                },
              ],
            },
          ]}
        />
      </div>
      {!hasPrices && <NoRecords className="h-60" />}
      {displayPrices?.map((price) => {
        const ruleEntries = price.rules
          ? Object.entries(price.rules).filter(
              ([, v]) => v !== null && v !== undefined
            )
          : []

        return (
          <div
            key={price.id}
            className="txt-small text-ui-fg-subtle flex items-center justify-between px-6 py-4"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {price.currency_code.toUpperCase()}
              </span>
              {ruleEntries.length > 0 && (
                <Tooltip
                  content={ruleEntries
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                >
                  <Badge size="2xsmall" className="text-ui-fg-muted">
                    {ruleEntries[0][1] as string}
                    {ruleEntries.length > 1 ? "…" : ""}
                  </Badge>
                </Tooltip>
              )}
            </div>
            <span>{getLocaleAmount(price.amount, price.currency_code)}</span>
          </div>
        )
      })}
      {hasPrices && (
        <div className="txt-small text-ui-fg-subtle flex items-center justify-between px-6 py-4">
          <span className="font-medium">
            {t("products.variant.pricesPagination", {
              total: allPrices.length,
              current: Math.min(pageSize, allPrices.length),
            })}
          </span>
          <Button
            onClick={onShowMore}
            disabled={pageSize >= allPrices.length}
            className="-mr-3 text-blue-500"
            variant="transparent"
          >
            {t("actions.showMore")}
          </Button>
        </div>
      )}
    </Container>
  )
}
