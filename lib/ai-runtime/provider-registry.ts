import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import type { AIProviderMetadata } from "@/lib/ai-runtime/provider-types"
import { AIProviderError } from "@/lib/ai-runtime/provider-errors"

export class AIProviderRegistry {
  private readonly providers = new Map<string, AIProviderAdapter>()

  register(provider: AIProviderAdapter) {
    this.providers.set(provider.config.id, provider)
    return this
  }

  resolve(providerId: string) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new AIProviderError(
        "CONFIGURATION_ERROR",
        `AI provider "${providerId}" is not registered.`,
        { providerId }
      )
    }
    return provider
  }

  has(providerId: string) {
    return this.providers.has(providerId)
  }

  metadata(providerId: string): AIProviderMetadata {
    return this.resolve(providerId).getMetadata()
  }

  listMetadata(): AIProviderMetadata[] {
    return Array.from(this.providers.values()).map((provider) => provider.getMetadata())
  }
}

export function createProviderRegistry(providers: AIProviderAdapter[] = []) {
  const registry = new AIProviderRegistry()
  for (const provider of providers) {
    registry.register(provider)
  }
  return registry
}
