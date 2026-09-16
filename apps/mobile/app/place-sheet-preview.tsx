/**
 * Development route for the festival place sheet.
 *
 * Not deep-linkable: `+native-intent.tsx` allowlists paths, and this one is not
 * on the list.
 */

import { PlaceSheetPreviewScreen } from '@/features/eventmap/preview/PlaceSheetPreviewScreen';

export default function PlaceSheetPreviewRoute() {
  return <PlaceSheetPreviewScreen />;
}
