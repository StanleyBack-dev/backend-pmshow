import { Logger } from "@nestjs/common";
import {
  formatVenueAddress,
  normalizeAddressNumber,
  normalizeState,
  normalizeZipCode,
} from "@/modules/events/domain/venue-address";
import { ViaCepAdapter } from "@/modules/events/infrastructure/zip-code/viacep.adapter";

describe("venue address", () => {
  it.each([
    ["74.000-000", "74000000"],
    ["74000000", "74000000"],
    ["7400000", null],
    ["740000000", null],
  ])("normalizeZipCode(%p) → %p", (value, expected) => {
    expect(normalizeZipCode(value)).toBe(expected);
  });

  it.each([
    ["123", "123"],
    [" 12a ", "12A"],
    ["s/n", "S/N"],
    ["SN", "S/N"],
    ["12-3", null],
    ["casa", null],
  ])("normalizeAddressNumber(%p) → %p", (value, expected) => {
    expect(normalizeAddressNumber(value)).toBe(expected);
  });

  it("accepts only Brazilian states", () => {
    expect(normalizeState(" go ")).toBe("GO");
    expect(normalizeState("XX")).toBeNull();
  });

  it("prints the address in one line", () => {
    expect(
      formatVenueAddress({
        zipCode: "74000000",
        street: "Rua 10",
        number: "123",
        complement: "Bloco B",
        district: "Setor Oeste",
        city: "Goiânia",
        state: "GO",
      }),
    ).toBe("Rua 10, 123, Bloco B – Setor Oeste, Goiânia/GO, CEP 74000-000");
    expect(
      formatVenueAddress({
        zipCode: null,
        street: null,
        number: null,
        complement: null,
        district: null,
        city: "Goiânia",
        state: "GO",
      }),
    ).toBe("Goiânia/GO");
  });
});

describe("ViaCepAdapter", () => {
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => jest.restoreAllMocks());

  const reply = (body: unknown, status = 200) =>
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("maps the postal address", async () => {
    reply({
      cep: "74000-000",
      logradouro: "Rua 10",
      bairro: "Setor Oeste",
      localidade: "Goiânia",
      uf: "go",
    });
    await expect(new ViaCepAdapter().find("74000000")).resolves.toEqual({
      zipCode: "74000000",
      street: "Rua 10",
      district: "Setor Oeste",
      city: "Goiânia",
      state: "GO",
    });
  });

  it("returns null for unknown CEPs and failures", async () => {
    reply({ erro: "true" });
    await expect(new ViaCepAdapter().find("99999999")).resolves.toBeNull();
    reply({}, 500);
    await expect(new ViaCepAdapter().find("99999999")).resolves.toBeNull();
  });
});
