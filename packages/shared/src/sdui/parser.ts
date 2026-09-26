/**
 * SDUI response parser — JSON → typed sections.
 *
 * Parses the v2 API envelope from `GET /ui/home/campus` into typed
 * `SduiSection` objects. Unknown section types become `SduiUnknown`
 * for backward compatibility (app won't break when server adds new types).
 *
 * Flutter source: lib/core/model/sdui_section.dart (SduiSection.fromJson)
 *                 lib/core/model/campus_sections_response.dart
 */

import type { ApiEnvelope } from '../api/types';
import type {
  SduiSection,
  SduiButtonItem,
  CampusSectionsResponse,
} from '../types/sdui';
import { parseActionType } from '../types/sdui';
import { parseBannerCarousel, type HomeBannerImage } from '../home/schema';

// ── Item parsers ──

function parseButtonItem(raw: Record<string, unknown>): SduiButtonItem {
  return {
    id: raw.id as string,
    title: raw.title as string,
    emoji: raw.emoji as string,
    actionType: parseActionType(raw.actionType as string),
    actionValue: raw.actionValue as string,
    ...(raw.webviewTitle != null && {
      webviewTitle: raw.webviewTitle as string,
    }),
    ...(raw.webviewColor != null && {
      webviewColor: raw.webviewColor as string,
    }),
  };
}

// ── Section parser ──

function parseSection(raw: Record<string, unknown>): SduiSection {
  const type = raw.type as string;
  const id = (raw.id as string) ?? '';

  switch (type) {
    case 'button_grid':
      return {
        type: 'button_grid',
        id,
        columns: (raw.columns as number) ?? 4,
        items: (raw.items as Record<string, unknown>[]).map(parseButtonItem),
      };

    case 'section_title':
      return {
        type: 'section_title',
        id,
        title: raw.title as string,
      };

    case 'notice':
      return {
        type: 'notice',
        id,
        title: raw.title as string,
        actionType: parseActionType(raw.actionType as string),
        actionValue: raw.actionValue as string,
      };

    case 'banner':
      return {
        type: 'banner',
        id,
        imageUrl: raw.imageUrl as string,
        actionType: parseActionType(raw.actionType as string),
        actionValue: raw.actionValue as string,
      };

    case 'banner_carousel': {
      const carousel = parseBannerCarousel(raw);
      if (!carousel) return { type: 'unknown', id, originalType: type };
      return {
        ...carousel,
        items: carousel.items.filter((i): i is HomeBannerImage => i.type === 'image'),
      };
    }

    case 'spacer':
      return {
        type: 'spacer',
        id,
        height: (raw.height as number) ?? 16,
      };

    default:
      return {
        type: 'unknown',
        id,
        originalType: type,
      };
  }
}

// ── Response parser ──

/**
 * Parses a v2 API envelope into `CampusSectionsResponse`.
 * Expects `envelope.data.sections[]` from `GET /ui/home/campus`.
 */
export function parseCampusResponse(
  envelope: ApiEnvelope<unknown>,
): CampusSectionsResponse {
  const data = envelope.data as Record<string, unknown>;
  const rawSections = data.sections as Record<string, unknown>[];

  return {
    sections: rawSections.map(parseSection),
    minAppVersion: (data.minAppVersion as string) ?? null,
  };
}
