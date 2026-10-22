import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL ||= "postgres://unused@localhost:1/unused";
const { encrypt, endpointOk } = await import("../../src/push");

const b = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

/* The worked example in RFC 8291 section 5. */
const RFC = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("lock-screen notifications", () => {
  test("encryption matches the RFC 8291 worked example", async () => {
    const pub = b(RFC.asPublic);
    const jwk = { kty: "EC", crv: "P-256", d: RFC.asPrivate, x: Buffer.from(pub.slice(1, 33)).toString("base64url"), y: Buffer.from(pub.slice(33)).toString("base64url"), ext: true };
    const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicKey = await crypto.subtle.importKey("raw", pub, { name: "ECDH", namedCurve: "P-256" }, true, []);
    const out = await encrypt(b(RFC.plaintext), RFC.uaPublic, RFC.auth, { keys: { privateKey, publicKey }, salt: b(RFC.salt) });
    expect(Buffer.from(out).toString("base64url")).toBe(RFC.body);
  });
  test("only real push services are accepted", () => {
    expect(endpointOk("https://web.push.apple.com/QGx")).toBe(true);
    expect(endpointOk("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(endpointOk("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(endpointOk("http://web.push.apple.com/x")).toBe(false);
    expect(endpointOk("https://evil.example/push.apple.com")).toBe(false);
    expect(endpointOk("https://push.apple.com.evil.example/x")).toBe(false);
    expect(endpointOk("https://169.254.169.254/latest")).toBe(false);
  });
});
