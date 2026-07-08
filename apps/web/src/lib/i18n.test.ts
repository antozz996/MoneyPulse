import { describe, expect, it } from "vitest";

import {
  LANGUAGE_STORAGE_KEY,
  detectBrowserLanguage,
  loadStoredLanguage,
  persistLanguage,
  resolveInitialLanguage,
  translate
} from "./i18n";

describe("i18n helpers", () => {
  it("detects the browser language when supported", () => {
    expect(
      detectBrowserLanguage({
        language: "fr-FR",
        languages: ["fr-FR", "en-US"]
      })
    ).toBe("fr");
    expect(
      detectBrowserLanguage({
        language: "de-DE",
        languages: ["de-DE", "es-ES"]
      })
    ).toBe("es");
  });

  it("persists and loads the selected language", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      }
    };

    persistLanguage("it", storage);

    expect(store.get(LANGUAGE_STORAGE_KEY)).toBe("it");
    expect(loadStoredLanguage(storage)).toBe("it");
  });

  it("prefers stored language over browser language", () => {
    const storage = {
      getItem() {
        return "es";
      }
    };

    expect(
      resolveInitialLanguage({
        storage,
        navigator: {
          language: "fr-FR",
          languages: ["fr-FR"]
        }
      })
    ).toBe("es");
  });

  it("falls back to browser language on first visit", () => {
    expect(
      resolveInitialLanguage({
        storage: {
          getItem() {
            return null;
          }
        },
        navigator: {
          language: "it-IT",
          languages: ["it-IT", "en-US"]
        }
      })
    ).toBe("it");
  });

  it("returns translated error and navigation copy", () => {
    expect(translate("it", "errors.networkUnavailable")).toContain("API");
    expect(translate("fr", "nav.today")).toBe("Aujourd'hui");
    expect(translate("es", "buy.checkPurchase")).toBe("Comprobar esta compra");
  });
});
