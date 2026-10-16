import { afterEach, describe, expect, test } from "bun:test";
import { originOf } from "./doors";

const forged = new Headers({ host: "pintakasi.example", "x-forwarded-host": "evil.example" });

describe("originOf", () => {
  afterEach(() => {
    delete process.env.PINTAKASI_PUBLIC_ORIGIN;
  });

  test("a pinned public origin ignores whatever host the request claims", () => {
    process.env.PINTAKASI_PUBLIC_ORIGIN = "https://pintakasi.example/";
    expect(originOf(forged)).toBe("https://pintakasi.example");
  });

  test("unpinned, it falls back to the forwarded headers", () => {
    expect(originOf(forged)).toBe("https://evil.example");
  });
});
