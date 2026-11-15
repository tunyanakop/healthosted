import { describe, expect, it } from "vitest";
import { crc32, createZip } from "@/lib/zip";

describe("crc32", () => {
  it("совпадает с эталонным вектором", () => {
    // CRC-32 от ASCII "123456789" = 0xCBF43926
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(crc32(Buffer.from(""))).toBe(0);
  });
});

describe("createZip", () => {
  const zip = createZip([
    { name: "data.json", data: Buffer.from('{"a":1}', "utf8") },
    { name: "files/тест.txt", data: Buffer.from("привет", "utf8") },
  ]);

  it("начинается с сигнатуры локального заголовка", () => {
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  });

  it("заканчивается EOCD с правильным числом записей", () => {
    const eocdOffset = zip.length - 22;
    expect(zip.readUInt32LE(eocdOffset)).toBe(0x06054b50);
    expect(zip.readUInt16LE(eocdOffset + 8)).toBe(2);
    expect(zip.readUInt16LE(eocdOffset + 10)).toBe(2);
  });

  it("содержит имена файлов", () => {
    expect(zip.includes(Buffer.from("data.json"))).toBe(true);
    expect(zip.includes(Buffer.from("files/тест.txt"))).toBe(true);
  });

  it("пустой архив корректен", () => {
    const empty = createZip([]);
    expect(empty.length).toBe(22);
    expect(empty.readUInt32LE(0)).toBe(0x06054b50);
  });
});
