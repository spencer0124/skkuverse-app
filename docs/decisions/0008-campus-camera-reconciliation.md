---
title: Reconcile the Campus Toggle With the Camera by Offering, Not by Moving It
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-27
audience: internal
---

# Reconcile the Campus Toggle With the Camera by Offering, Not by Moving It

> Why the campus toggle never changes on its own, why markers stopped filtering by campus, and
> why the radius that decides all of it is served rather than compiled in. Read this before
> changing what the campus map does when the toggle and the camera disagree.

## Context

The campus map has a two-segment toggle, one segment per campus, and `selectedCampus` was
doing two unrelated jobs with it:

1. **A filter.** `MapMarkerLayer` kept only the markers whose `campus` matched.
2. **A camera destination.** Changing it animated the camera to that campus's centre.

Nothing kept the two in step, because the camera can move without the toggle. The locate
button is the ordinary way: it points the camera at the user, wherever they are. A user
standing on one campus with the other selected saw that campus's map with **no buildings on it
at all**, not off-screen but never rendered, while the toggle went on naming the campus they had
left. The map contradicted itself and said nothing about it.

This is not a corner case. `GET /map/config` puts the campus centres 32,692m apart, so
leaving one is leaving it entirely.

## Decision

### 1. The toggle holds exactly one campus, and only the user changes it

The toggle never follows the camera.

Letting it track whichever campus the camera is nearest would keep it always truthful. We
rejected that. It moves a control the user set while they watch it, and it needs the camera
destination decoupled from the selection to avoid a feedback loop. A control that changes under
the user is a worse failure than one briefly out of step.

### 2. Disagreement is surfaced as an offer, in a card above the sheet

When a camera settle leaves the two disagreeing, a single-line card appears in the map's lower
control row. It states a fact and puts the verb in a filled button:

| Camera | Card | Accepting it |
| --- | --- | --- |
| Inside the selected campus | none | — |
| Inside the **other** campus | "지금 {other}을 보고 있어요" <!-- conventions:allow-korean: the shipped card copy --> | Moves the toggle only |
| Inside neither | "가까운 캠퍼스는 {nearest}이에요" <!-- conventions:allow-korean: the shipped card copy --> | Moves the toggle, taking the camera with it |

The camera behaviour differs on purpose. Re-framing a campus the user is already looking at
takes away the view they just set. Being taken somewhere is the whole request when nothing on
screen is a campus. Where the nearest campus is the one already selected, nothing switches and
the camera move is the whole action — that is the way back from far away.

### 3. An explicit action outranks an inference

- Picking a campus from the toggle silences drift-driven cards **for the rest of the session**.
  The user has said which campus they want; continuing to suggest otherwise is arguing.
- Pressing locate is a newer explicit action, so it is never silenced by the above. Its result
  applies directly: standing inside a campus **switches to it silently**, since the user just
  asked where they are and the answer is that campus. Only "you are on neither" is worth a card.
- Location permission being refused outranks both. The card then offers to turn it on and
  **cannot be dismissed**, because the locate button is inert without it and a campus suggestion
  would be advice the user has no way to act on.

### 4. Markers no longer filter by campus

`MapMarkerLayer` draws everything the endpoint returns. That is what makes the offer honest:
the buildings under the camera are visible whether or not the toggle agrees, so the card
refines what is on screen rather than being what puts it there.

Affordable here specifically. The reasons are worth keeping, because a future layer would have
to match them. The campuses are ~33km apart, so one is always outside the viewport and the SDK
culls it natively. The endpoint already returned both sets in one response, so nothing extra is
fetched. Both layers across both campuses come to a small overlay count. A layer covering one
dense area, where every marker really would be on screen at once, would need this revisited.

### 5. The radius is served, not compiled in

`campuses[].radiusM` on `GET /map/config` decides "inside a campus". It lives beside the
coordinates it is measured against instead of being duplicated per client.

It is optional on both sides and stays that way. A server predating the field sends nothing, and
a client predating it ignores it. **The client's fallback constant is permanent**, not
scaffolding to remove after the deploy: a build already on a phone cannot assume the server it
talks to has the field.

The value is derived from the marker data the same service returns rather than chosen: the
furthest building from each campus centre is well under half the radius, and the radius is a few
per cent of the distance between the two centres, so the circles cannot overlap and "which
campus" is never ambiguous. The measurements and the derivation live in the constant's own
comment, so they cannot drift from the number they justify.

## Consequences

- **The map can be honest without moving anything the user set.** The toggle stays put; the
  card explains the difference and offers the fix.
- **The decision is a pure function.** `resolveCampusSuggestion` takes coordinates and returns
  a suggestion or `null`, knowing nothing about React or the map, and is unit-tested against the
  real campus coordinates. Anything that changes the policy changes it there.
- **The server field and the client reading it deploy in either order.** That holds only
  because both sides treat the field as optional.
- **The suppression flags are session-scoped and deliberately not persisted.** They are about
  this sitting, not a preference. A relaunch starts offering again.
- **A locate press has to be told apart from a pan, and that is timing-sensitive.** Switching
  tracking on makes the SDK emit a camera-idle while the camera is still at the *old* position,
  before it has moved — so "the press is answered" cannot mean "the first idle arrived". The
  press is treated as answered only once an idle produces an actual decision, bounded by a short
  expiry so a press that never produces one cannot claim a later, unrelated pan. This was found
  by testing rather than by reading: the two rules in section 3 masked each other, and the
  symptom was a silent no-op.
- **`onCameraIdle`, not `onCameraChanged`.** The SDK withholds idle until a gesture has fully
  ended, which is the settle signal this needs. `onCameraChanged` fires every frame of a pan and
  would need debouncing to answer the same question.

## Related

- [Map Config API Specification](../reference/map-config-api-spec.md) — the `radiusM` contract
- [Campus map reconciliation](../explanation/campus-map-reconciliation.md) — the order things
  happen in, and the native behaviour behind it
