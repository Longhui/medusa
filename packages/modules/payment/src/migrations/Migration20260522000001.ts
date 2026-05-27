import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260522000001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_provider" add column if not exists "data" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_provider" drop column if exists "data";`
    )
  }
}
