/**
 * Default campus sections — fallback when API fails.
 *
 * Matches Flutter's `campus_service_defaults.dart`.
 * Provides a basic button grid so the campus tab is never empty.
 *
 * Flutter source: lib/features/campus_map/data/campus_service_defaults.dart
 */

import type { CampusSectionsResponse } from '../types/sdui';

export const DEFAULT_CAMPUS_SECTIONS: CampusSectionsResponse = {
  sections: [
    {
      type: 'button_grid',
      id: 'default_grid',
      columns: 4,
      items: [
        {
          id: 'building_map',
          title: '건물지도',
          emoji: '\u{1F3E2}',
          actionType: 'route',
          actionValue: '/map/hssc',
        },
        {
          id: 'building_code',
          title: '건물코드',
          emoji: '\u{1F522}',
          actionType: 'route',
          actionValue: '/search',
        },
        {
          id: 'lost_found',
          title: '분실물',
          emoji: '\u{1F9F3}',
          actionType: 'webview',
          actionValue: 'https://webview.skkuuniverse.com/#/skku/lostandfound',
          webviewTitle: '분실물',
          webviewColor: '003626',
        },
        {
          id: 'inquiry',
          title: '문의하기',
          emoji: '\u{1F4AC}',
          actionType: 'external',
          actionValue: 'https://pf.kakao.com/_cjxexdG/chat',
        },
      ],
    },
  ],
  minAppVersion: null,
};
