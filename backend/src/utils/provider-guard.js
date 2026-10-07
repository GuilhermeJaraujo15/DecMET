import { POLICY } from "../config/policy.js";
import { logEvent } from "./observability.js";

// Two provider states per instance. No retries, timers, or detached background work.
const states = new Map();
export async function guardedProvider(provider, icao, operation, unavailable) {
  let state = states.get(provider);
  if (!state) states.set(provider, state = { failures: 0, until: 0, probe: false, generation: 0 });
  const now = Date.now();
  if (state.until > now || state.probe) throw unavailable();
  const probing = state.until !== 0;
  if (probing) state.probe = true;
  const generation = state.generation;
  let status = 200, code = "OK";
  try {
    const result = await operation();
    if (state.generation === generation) { state.failures = 0; state.until = 0; }
    return result;
  } catch (error) {
    status = Number(error.status) || 502;
    code = /^(NOAA|REDEMET)_[A-Z_]+$/.test(error.code || "") || error.code === "NO_METAR_FOUND" ? error.code : "PROVIDER_ERROR";
    if (error.code === "NO_METAR_FOUND") {
      if (state.generation === generation) { state.failures = 0; state.until = 0; }
    } else if (state.generation === generation && ++state.failures >= POLICY.providerFailureThreshold) {
      state.until = Date.now() + POLICY.providerCooldownMs;
      state.generation++;
    }
    throw error;
  } finally {
    if (probing) state.probe = false;
    logEvent({ event: "provider_call", provider, icao, status, code, timeout: code.includes("TIMEOUT"), durationMs: Date.now() - now });
  }
}
