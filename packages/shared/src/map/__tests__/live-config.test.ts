/**
 * The parser against a real `GET /map/config` response.
 *
 * The unit suites next door feed the parser shapes chosen to exercise one rule
 * each. This one feeds it the bytes production actually served, captured during
 * an open festival activation so the fixture carries both halves of the
 * response — the two permanent building layers and the six festival ones, plus
 * all seven chips.
 *
 * What it guards is the seam the unit tests cannot see: that the field names,
 * nesting and value shapes the server ships are the ones the parser reaches
 * for. Every one of these fields was additive, and a parser reading for a key
 * the server does not send answers `undefined` with no error on either side —
 * which is exactly how `campuses[].radiusM` came to be served, declared and
 * consumed while every campus silently used the hardcoded fallback.
 *
 * The fixture is a snapshot, not a contract. A festival closing changes what
 * the live endpoint returns; it does not change what this file asserts, and a
 * failure here means the SCHEMA moved. The contract is
 * `skkuverse-server/docs/reference/map-markers-api.md`.
 */

import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '../../api/types';
import { parseMapConfig } from '../parser';
import {
  findNarrowedChip,
  resolveChipGroupDefaults,
  resolveChipLayerVisibility,
} from '../chips';
import liveConfig from './fixtures/map-config-live.json';

const CONFIG = parseMapConfig(liveConfig as unknown as ApiEnvelope<unknown>);
const layerIds = CONFIG.layers.map((l) => l.id);

describe('the live response, parsed whole', () => {
  it('keeps every layer and every chip', () => {
    // Nothing dropped. A drop here is the parser rejecting something real.
    expect(CONFIG.layers).toHaveLength(liveConfig.data.layers.length);
    expect(CONFIG.chips).toHaveLength(liveConfig.data.chips.length);
  });

  it('reads the camera defaults rather than falling back to them', () => {
    // Equal to the fallback today, which is why this asserts against the
    // fixture's own numbers: a test against the constant would pass even if the
    // field were never read.
    expect(CONFIG.cameraDefaults.markerFocus.zoom).toBe(
      liveConfig.data.cameraDefaults.markerFocus.zoom,
    );
    expect(CONFIG.cameraDefaults.campusFocus.durationMs).toBe(
      liveConfig.data.cameraDefaults.campusFocus.durationMs,
    );
  });

  it('puts the building layers outside every chip group', () => {
    const buildings = CONFIG.layers.filter((l) => l.endpoint === '/map/markers/campus');
    expect(buildings.length).toBeGreaterThan(0);
    for (const layer of buildings) expect(layer.chipGroupId).toBeNull();
  });

  it('reads the geometry that used to be hardcoded', () => {
    const numbers = CONFIG.layers.find((l) => l.markerStyle === 'numberCircle');
    const labels = CONFIG.layers.find((l) => l.markerStyle === 'textLabel');
    const pin = CONFIG.layers.find((l) => l.markerStyle === 'placeDot');
    expect(numbers?.style?.size).toBeGreaterThan(0);
    expect(labels?.style?.zIndex).toBeGreaterThan(0);
    expect(pin?.style?.width).toBeGreaterThan(0);
    expect(pin?.style?.height).toBeGreaterThan(0);
  });

  it('leaves no chip pointing at a layer that is not served', () => {
    for (const chip of CONFIG.chips) {
      if (chip.action.kind !== 'focus') continue;
      for (const id of chip.action.layerIds) expect(layerIds).toContain(id);
    }
  });

  it('resolves every focus chip to a real visibility write', () => {
    const focusChips = CONFIG.chips.filter((c) => c.action.kind === 'focus');
    expect(focusChips.length).toBeGreaterThan(0);
    for (const chip of focusChips) {
      const next = resolveChipLayerVisibility(chip, CONFIG.layers);
      expect(next, `chip ${chip.id} resolves no group`).not.toBeNull();
      // Rule 1: a chip must never so much as mention a building layer.
      for (const id of Object.keys(next ?? {})) {
        expect(CONFIG.layers.find((l) => l.id === id)?.chipGroupId).not.toBeNull();
      }
    }
  });

  it('leaves no chip label unresolved by the server i18n table', () => {
    // `t()` returns the key on a miss, silently, so a chip with no translation
    // would render `map.chip.<id>` as its visible label.
    for (const chip of CONFIG.chips) expect(chip.label).not.toMatch(/^map\.chip\./);
    for (const layer of CONFIG.layers) expect(layer.label).not.toMatch(/^map\.layer\./);
  });

  it('gives the reset chip a way back that turns nothing extra on', () => {
    // The reset chip restores the group's DEFAULT set, not literally every
    // layer: naming an opt-in layer would turn on something the user never
    // asked for and leave no chip that returns to the ordinary view.
    const reset = CONFIG.chips.find((c) => c.id === 'eskara26_view_all');
    if (!reset) return; // no festival in the fixture — nothing to assert
    expect(resolveChipLayerVisibility(reset, CONFIG.layers)).toEqual(
      resolveChipGroupDefaults(reset, CONFIG.layers),
    );
  });

  it('names no chip on a fresh launch, where nothing has been narrowed', () => {
    // Every layer at its own default, which is the state `initFromConfig` seeds.
    // The reset chip matches this exactly, and is deliberately not named: the
    // strip means "you narrowed to this", and the launch state is the server's.
    const fresh = Object.fromEntries(
      CONFIG.layers.map((l) => [l.id, { visible: l.defaultVisible }]),
    );
    expect(findNarrowedChip(CONFIG.chips, CONFIG.layers, fresh)).toBeNull();
  });

  it('names the chip a real narrowing lands on', () => {
    const stage = CONFIG.chips.find((c) => c.id === 'eskara26_view_stage');
    if (!stage) return; // no festival in the fixture — nothing to assert
    const target = resolveChipLayerVisibility(stage, CONFIG.layers) ?? {};
    const narrowed = Object.fromEntries(
      CONFIG.layers.map((l) => [
        l.id,
        { visible: l.id in target ? target[l.id] : l.defaultVisible },
      ]),
    );
    expect(findNarrowedChip(CONFIG.chips, CONFIG.layers, narrowed)?.id).toBe(
      'eskara26_view_stage',
    );
  });
});
