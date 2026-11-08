import "server-only";
import { mockProvider } from "./mock";
import { israeliProvider } from "./israeli-provider.template";
import { PaymentNotConfiguredError, type PaymentProvider } from "./types";

const PROVIDERS: Record<string, PaymentProvider> = {
  mock: mockProvider,
  provider: israeliProvider,
};

export function mockAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

export function getPaymentProvider(id = process.env.PAYMENT_PROVIDER || (mockAllowed() ? "mock" : "")): PaymentProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new PaymentNotConfiguredError();
  if (provider.id === "mock" && !mockAllowed()) throw new PaymentNotConfiguredError("Mock payments are disabled in production");
  return provider;
}
