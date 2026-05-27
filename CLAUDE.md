# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Medusa Core

Open-source commerce platform. TypeScript monorepo with 30+ modular commerce packages.

## Codebase Structure

```
/packages/
├── medusa/              # Main Medusa package (API routes, admin, store)
├── core/                # Core framework packages
│   ├── framework/       # Core runtime: HTTP, database, subscribers, jobs, links
│   ├── types/           # TypeScript definitions (DTOs, interfaces)
│   ├── utils/           # Utilities, decorators, model DSL
│   ├── workflows-sdk/   # Workflow composition engine
│   ├── core-flows/      # Predefined commerce workflows
│   ├── modules-sdk/     # Module loading/registration system
│   ├── orchestration/   # Workflow orchestration engine
│   └── js-sdk/          # Client SDK (store, admin, auth)
├── modules/             # 30+ commerce modules
│   ├── product/         # Example: models/, services/, migrations/
│   ├── order/, cart/, payment/ ...
│   └── providers/       # 15+ provider implementations (file-s3, payment-stripe, ...)
├── admin/               # Dashboard packages
│   └── dashboard/       # React admin UI (Vite, Tailwind, i18n)
├── cli/                 # CLI tools
├── design-system/       # UI component library (React, Tailwind, Storybook)
├── integration-tests/   # Full-stack integration tests
│   ├── http/            # HTTP API tests (admin + store routes)
│   └── modules/         # Module integration tests
```

## Essential Commands

**Package Manager**: Yarn 3.2.1 with node-modules linker

```bash
# Install dependencies
yarn install

# Build all packages (via Turborepo)
yarn build

# Build specific package
yarn workspace @medusajs/medusa build

# Watch mode (inside package directory)
yarn watch

# Lint
yarn lint

# Format
yarn prettier --write <file>

# Run all unit tests
yarn test

# Run tests in specific package
yarn workspace @medusajs/product test

# Integration tests
yarn test:integration:packages  # package-level integration tests
yarn test:integration:http      # HTTP API integration tests
yarn test:integration:modules   # module integration tests

# Generate types / OAS
yarn openai:types
```

## Module Internal Structure

Each commerce module follows a consistent layout:

```
packages/modules/<module>/
├── src/
│   ├── models/          # MikroORM entity models (using `model.*` DSL)
│   ├── migrations/      # Migration files (timestamp-based)
│   ├── services/        # Service class extending MedusaService
│   ├── repositories/    # Custom repository overrides (optional)
│   ├── types/           # Module-specific types/DTOs
│   ├── utils/           # Helpers
│   ├── index.ts         # Module entry point (registers models, services, loaders)
│   └── joiner-config.ts # Link/relationship configuration
```

### Model Definitions (DSL)

Models use a fluent DSL from `@medusajs/framework/utils`:

```typescript
import { model } from "@medusajs/framework/utils"

const Product = model.define("Product", {
  id: model.id({ prefix: "prod" }).primaryKey(),
  title: model.text().searchable(),
  handle: model.text(),
  description: model.text().nullable(),
  is_giftcard: model.boolean().default(false),
  status: model.enum(ProductUtils.ProductStatus).default(ProductUtils.ProductStatus.DRAFT),
  weight: model.float().nullable(),
  // Relationships
  categories: model.manyToMany(() => ProductCategory, {
    mappedBy: "products",
  }),
  collection: model.belongsTo(() => ProductCollection, { nullable: true }),
  variants: model.hasMany(() => ProductVariant, {
    mappedBy: "product",
  }),
  metadata: model.json().nullable(),
})
```

### Migrations

Migrations live in `src/migrations/` following a naming convention `Migration<YYYYMMDD><description>.ts`. They manually define the SQL for migration + rollback:

```typescript
import { Migration } from "@mikro-orm/migrations"

export class Migration20241122120331 extends Migration {
  async up(): Promise<void> {
    this.addSql('ALTER TABLE "product" ADD COLUMN "type_id" text NULL;')
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE "product" DROP COLUMN "type_id";')
  }
}
```

## API Route Patterns

### Admin Routes: `packages/medusa/src/api/admin/<entity>/route.ts`

Named exports for HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). Use `AuthenticatedMedusaRequest` for admin, `MedusaRequest` for store.

Request typing and query utilities:
```typescript
import { deleteOrderWorkflow } from "@medusajs/core-flows"
import { HttpTypes } from "@medusajs/framework/types"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<HttpTypes.AdminOrderDeleteResponse>
) => {
  const { id } = req.params
  await deleteOrderWorkflow(req.scope).run({ input: { id } })
  res.status(200).json({ id, object: "order", deleted: true })
}
```

**Key request utilities:**
- `req.filterableFields` - fields available for filtering
- `req.queryConfig.pagination` - pagination config (skip, take)
- `req.queryConfig.fields` - requested fields
- `req.scope.resolve(ContainerRegistrationKeys.QUERY)` - resolve query service

### Store Routes: `packages/medusa/src/api/store/<entity>/route.ts`

Same pattern but uses `MedusaRequest` (non-authenticated or customer-authenticated).

### Route File-based Discovery

Routes are auto-discovered from the filesystem. Route files can be:
- `route.ts` - standard REST methods
- `validators.ts` - Zod validation schemas (export `*Validations` / `*Fields`)
- `middlewares.ts` - route-specific middleware
- `helpers.ts` - shared helpers

## Workflow Pattern

Workflows live in `packages/core/core-flows/src/<domain>/`:

**Steps** (`createStep`):
```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const deletePromotionsStep = createStep(
  "delete-promotions",
  async (ids: string[], { container }) => {
    const promotionModule = container.resolve<IPromotionModuleService>(Modules.PROMOTION)
    await promotionModule.softDeletePromotions(ids)
    return new StepResponse(void 0, ids)
  },
  async (idsToRestore, { container }) => {
    if (!idsToRestore?.length) return
    const promotionModule = container.resolve<IPromotionModuleService>(Modules.PROMOTION)
    await promotionModule.restorePromotions(idsToRestore)
  }
)
```

**Workflows** (`createWorkflow`):
```typescript
import { createWorkflow, WorkflowData, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createHook } from "@medusajs/framework/utils"

export const deletePromotionsWorkflow = createWorkflow(
  "delete-promotions",
  (input: WorkflowData<{ ids: string[] }>) => {
    const deletedPromotions = deletePromotionsStep(input.ids)
    const promotionsDeleted = createHook("promotionsDeleted", { ids: input.ids })
    return new WorkflowResponse(deletedPromotions, { hooks: [promotionsDeleted] })
  }
)
```

**Common patterns:** `transform()`, `when()`, `parallelize()`, `useQueryGraphStep()`

## Event & Subscriber Pattern

Events emitted via `@EmitEvents()` decorator in services or via `createHook()` in workflows.

Subscribers auto-discover from the filesystem:

```typescript
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function mySubscriber({ event, container }: SubscriberArgs) {
  const service = container.resolve("someService")
  // handle event
}

export const config: SubscriberConfig = {
  event: "product.created",
  context: { subscriberId: "my-unique-id" },
}
```

Subscribers live in `packages/core/framework/src/subscribers/` (tested in `__tests__/`).

## Module Links / Relationships

Links between modules are configured in `joiner-config.ts`:

```typescript
export const joinerConfig = {
  serviceName: Modules.PRODUCT,
  primaryKeys: ["id", "handle"],
  linkableKeys: { product_id: "Product" },
  alias: [
    { name: ["product", "products"], args: { entity: "Product" } },
  ],
}
```

Cross-module links are defined as separate link modules in `packages/modules/link-modules/`.

## Admin Dashboard (React)

Located at `packages/admin/dashboard/src/`:

```
src/
├── routes/        # Route-based pages (orders/, customers/, products/, ...)
│   └── customers/
│       ├── customer-list/         # List page
│       ├── customer-detail/       # Detail page
│       ├── customer-create/       # Create form
│       ├── customer-edit/         # Edit form
│       └── customer-metadata/     # Metadata widget
├── components/    # Shared UI components
├── hooks/         # Custom hooks
├── providers/     # React context providers
├── lib/           # Utilities
└── i18n/          # Internationalization (translations)
```

- Built with React, Vite, Tailwind CSS
- Translations in `src/i18n/` (JSON files per language)
- Design system components in `packages/design-system/ui/src/components/`

## JS SDK

Located at `packages/core/js-sdk/src/`:

```
src/
├── client.ts    # HTTP client (fetch-based)
├── types.ts     # SDK-specific types
├── admin/       # Admin API client methods
├── store/       # Store API client methods
└── auth/        # Auth helpers (MFA, etc.)
```

## Integration Tests

Located in `integration-tests/`:

```
integration-tests/http/__tests__/
├── admin/        # Admin API route tests
│   ├── products/
│   ├── orders/
│   └── ...
└── store/        # Store API route tests

integration-tests/modules/__tests__/  # Module-level integration tests
```

Tests use:
- Custom test runners with DB setup/teardown (PostgreSQL via `medusa-test-utils`)
- `globalSetup.js.txt` / `globalTeardown.js.txt` for test lifecycle
- `factories/` for creating test data
- `environment-helpers/` for test environment configuration

## Code Style

- **Formatting**: No semicolons, double quotes, 2-space indent, ES5 trailing commas
- **Naming**: kebab-case files, PascalCase types/classes, camelCase functions/vars, SCREAMING_SNAKE_CASE constants, snake_case DB fields
- **TypeScript**: ES2021 target, Node16 module, strict null checks, decorators enabled
- **Export**: Barrel exports via `export * from`

## Common Imports

```typescript
// Framework utils
import { InjectManager, MedusaContext, MedusaError, MedusaService, EmitEvents, Modules } from "@medusajs/framework/utils"

// Types
import type { Context, DAL, IOrderModuleService } from "@medusajs/framework/types"

// Workflows
import { WorkflowData, WorkflowResponse, createStep, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"

// Core flows
import { deleteOrderWorkflow } from "@medusajs/core-flows"

// HTTP
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Container keys
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Model DSL
import { model } from "@medusajs/framework/utils"
```

## Error Handling

```typescript
import { MedusaError } from "@medusajs/framework/utils"

throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order with id: ${id} was not found")
throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid input")
throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Cannot update a cancelled order")
```

## Path Aliases (per-module tsconfig)

- `@models` - Entity models
- `@types` - DTO and type definitions
- `@services` - Service dependencies
- `@repositories` - Data access layer
- `@utils` - Utility functions
