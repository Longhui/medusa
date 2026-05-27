import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { PayPalProviderService } from "./services"

const services = [PayPalProviderService]

export default ModuleProvider(Modules.PAYMENT, {
  services,
})
