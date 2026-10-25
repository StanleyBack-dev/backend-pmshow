import { Injectable, Logger } from "@nestjs/common";
import type {
  ZipCodeAddress,
  ZipCodeLookupPort,
} from "@/modules/events/application/ports/events.ports";

const TIMEOUT_MS = 6_000;

type ViaCepResponse = {
  erro?: boolean | string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

// ViaCEP: free CEP lookup, no key. Failures count as "not found": the
// address can always be typed by hand.
@Injectable()
export class ViaCepAdapter implements ZipCodeLookupPort {
  private readonly logger = new Logger(ViaCepAdapter.name);

  async find(zipCode: string): Promise<ZipCodeAddress | null> {
    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${zipCode}/json/`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (!response.ok) {
        this.logger.warn(`ViaCEP respondeu HTTP ${response.status}`);
        return null;
      }
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro || !data.localidade || !data.uf) return null;
      return {
        zipCode,
        street: data.logradouro?.trim() || null,
        district: data.bairro?.trim() || null,
        city: data.localidade.trim(),
        state: data.uf.trim().toUpperCase(),
      };
    } catch (error) {
      this.logger.warn(`ViaCEP indisponível: ${String(error)}`);
      return null;
    }
  }
}
