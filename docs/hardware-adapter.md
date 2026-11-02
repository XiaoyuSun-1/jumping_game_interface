# Lab adapter contract

NeuroRunner supplies a browser client contract, not a FinalSpark backend. No SDK, laboratory credentials, live hardware connection, stimulation configuration, or electrode mapping is included. Selecting an endpoint or receiving valid JSON does not verify the presence, identity, viability, or activity of an organoid. Every health property is **adapter-reported**; even `source: "hardware"` is an assertion by that adapter.

## Browser exports

`dist/hardware.js` exports:

- `validateAdapterHealth(data)` returns a shallow copy of valid health metadata or throws.
- `deriveAdapterEndpoints(stepUrl)` returns `{step, health, stop}`. `https://lab.example/api/v1/step` yields sibling `/api/v1/health` and `/api/v1/stop` routes. A trailing slash on `/step/` is accepted. Other terminal paths, query strings, fragments, and embedded credentials are rejected. Existing endpoint rules allow HTTPS or HTTP on loopback only.
- `probeAdapter(stepUrl, {fetchImpl = globalThis.fetch, timeoutMs = 2000} = {})` returns a promise for `{metadata, round_trip_ms, checked_at}` after a read-only health request.
- `stopAdapter(stepUrl, options)` returns the same result shape after a stop acknowledgement. Invoke it only on an explicit operator action. It never enables stimulation.

Timeouts must be numeric, finite, and between 1 and 10,000 milliseconds. The timer covers both the request and JSON decoding; expiry aborts fetch and rejects even if an implementation ignores abort. Requests omit browser credentials, disable cache, reject redirects, and ask for JSON. Timing measures the complete request and validation, not neural response latency. `checked_at` is the browser's UTC completion time. HTTP errors, invalid JSON, invalid schemas, and timeouts reject; callers must display failure and must not invent a successful connection or stop state. Probing does not start recording, send trial packets, upload parameters, trigger hardware, or call `/stop`.

## GET /health

Return HTTP 200 and a JSON object with **exactly** these fields:

```json
{
  "schema": "neurorunner.adapter-health.v1",
  "platform": "Operator-provided platform name",
  "source": "hardware",
  "adapter_version": "1.0.0",
  "channel_count": 32,
  "recording": true,
  "stimulation_enabled": false,
  "observed_at": "2026-11-01T12:00:00.000Z"
}
```

The timestamp above is illustrative; generate a current observation on each request. `platform` and `adapter_version` are nonempty strings of at most 256 characters. `source` is `hardware` or `simulation`; the UI must preserve that distinction. `channel_count` is a positive safe integer describing the adapter's physical acquisition or simulation channels. `recording` and `stimulation_enabled` are booleans describing observed state, never permissions to change it. Metadata contains no credentials or patient identifiers.

`observed_at` uses canonical UTC ISO 8601 with milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`). Invalid calendar dates are rejected. Health may be at most 30 seconds old or five seconds ahead of the browser clock. These are client freshness limits, chosen to reject cached state while allowing brief polling and clock skew; they are not FinalSpark timing specifications or evidence that hardware is safe. Keep both clocks synchronized. A successful probe is a point-in-time report and expires; it must not remain a permanent “connected” assertion after failed or stale checks.

## POST /stop

This endpoint accepts an empty request body and returns HTTP 200 only after completing its stop workflow and confirming stimulation is disabled:

```json
{"schema":"neurorunner.adapter-stop.v1","stimulation_enabled":false}
```

These are the exact response fields. A timeout, unavailable route, network error, or other response means **stop unconfirmed**. A browser pause, disconnected endpoint, aborted request, hidden page, or closed tab cannot guarantee hardware stopped. The acknowledgement reports adapter confirmation; independently inspect the laboratory state when needed. Never call this route as part of health probing or background polling.

## Existing POST /step

The existing game bridge sends `neurorunner.bridge.v1` JSON containing `request_id`, `session_id`, `game_time_ms`, `session_time_ms`, `phase`, `phase_remaining_ms`, `bin_ms: 50`, and `packets`. It expects `{ "request_id": <matching id>, "counts": [<eight integers>] }`, with each count between 0 and 100. The eight response channels are game channels; they do not establish a mapping to a particular MEA or organoid. The existing client requests one response at a time with a two-second timeout. These browser timings are unsuitable as hardware timing guarantees.

## Operator-owned implementation

The adapter must implement these routes with CORS restricted to the intended frontend origin and laboratory-side authorization. The browser sends no cookies or HTTP authentication and must never hold FinalSpark credentials. Do not expose an unauthenticated hardware control service on the public internet. Health must remain read-only. The adapter must reject `/step` stimulation unless an operator has separately approved a validated protocol; game intensity and model units are not calibrated laboratory stimulation parameters.

The operator's adapter owns hardware timing, validated channel mapping, count bin alignment, session/request deduplication, recording readiness, bounds, logs, error recovery, cleanup, and a lab-side watchdog. It must stop stimulation on lost browser contact and expired sessions independently of whether the browser can reach `/stop`. Stop handling should be idempotent and cancel queued commands. Do not silently replace missing hardware data with simulated counts; report an error or explicitly label a simulation source.

FinalSpark's [official v2 API guide](https://finalspark-np.github.io/np-docs/np_core/doc_v2.html) recommends the Python controllers rather than internal protocols. It requires laboratory access and valid authorization. Parameter uploads interrupt recording, so the adapter must wait at least five seconds before triggering or reading again, and disable stimulation after completion or errors. Operator validation must cover mapping, electrical parameters, and booking; hardware-changing agent tools require approval, bounds, logs, and cleanup. No such operations were performed here. The [official best practices](https://finalspark-np.github.io/np-docs/np_core/best_practices.html) also call for cleanup and recording setup metadata.
