import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
}

export function isPrivateOrReservedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (version === 6) {
    const ip = address.toLowerCase();
    return (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      /^fe[89ab]/.test(ip) ||
      ip.startsWith("ff") ||
      ip.startsWith("2001:db8:") ||
      ip.startsWith("::ffff:127.") ||
      ip.startsWith("::ffff:10.") ||
      ip.startsWith("::ffff:192.168.")
    );
  }

  return true;
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked URL protocol: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error("Blocked URL credentials");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error(`Blocked hostname: ${url.hostname}`);
  }

  if (isIP(url.hostname)) {
    if (isPrivateOrReservedIp(url.hostname)) {
      throw new Error(`Blocked private/reserved IP: ${url.hostname}`);
    }
    return url;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error(`DNS resolution returned no addresses: ${url.hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(`Blocked DNS target ${url.hostname} -> ${address}`);
    }
  }

  return url;
}
