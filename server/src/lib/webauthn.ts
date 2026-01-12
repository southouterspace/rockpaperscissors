import { config } from "./env";

export const rpName = config.rpName;
export const rpID = config.rpId;
export const origin = config.origin;

// biome-ignore lint/performance/noBarrelFile: Re-exporting WebAuthn functions with config
export {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
