import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

interface PasskeyResult {
  success: boolean;
  error?: string;
}

interface RegisterOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
}

interface LoginOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export async function registerPasskey(userId: string): Promise<PasskeyResult> {
  try {
    // Get registration options from server
    const optionsResponse = await fetch(
      `/api/auth/register/options?userId=${userId}`
    );
    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return {
        success: false,
        error: error.message || "Failed to get options",
      };
    }

    const { options } =
      (await optionsResponse.json()) as RegisterOptionsResponse;

    // Start registration ceremony
    const credential = await startRegistration({ optionsJSON: options });

    // Verify registration with server
    const verifyResponse = await fetch("/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, credential }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return {
        success: false,
        error: error.message || "Failed to verify registration",
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      // User cancelled or other WebAuthn error
      if (error.name === "NotAllowedError") {
        return { success: false, error: "Registration was cancelled" };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unknown error occurred" };
  }
}

export async function loginWithPasskey(): Promise<PasskeyResult> {
  try {
    // Get authentication options from server
    const optionsResponse = await fetch("/api/auth/login/options");
    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return {
        success: false,
        error: error.message || "Failed to get options",
      };
    }

    const { options } = (await optionsResponse.json()) as LoginOptionsResponse;

    // Start authentication ceremony
    const credential = await startAuthentication({ optionsJSON: options });

    // Verify authentication with server
    const verifyResponse = await fetch("/api/auth/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return {
        success: false,
        error: error.message || "Failed to verify authentication",
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      // User cancelled or other WebAuthn error
      if (error.name === "NotAllowedError") {
        return { success: false, error: "Authentication was cancelled" };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unknown error occurred" };
  }
}
