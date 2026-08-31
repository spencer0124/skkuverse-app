/**
 * SDUI Section Renderer — maps section types to React Native components.
 *
 * Exhaustive switch on `section.type` with TypeScript `never` check at
 * the default case, ensuring compile-time errors when new section types
 * are added to the union but not handled here.
 *
 * **A widget owns no horizontal gutter.** The caller does, and the caller is
 * the only one that can: the campus sheet's card is inset from the screen by an
 * amount that animates as the sheet rises, so a gutter baked into a widget is
 * measured from the wrong edge, and from a different wrong edge at each detent.
 * The widgets disagreed with each other anyway — 20, 20 and 18 — which put
 * three different left edges in one column. Vertical spacing stays with the
 * widget, since nothing outside it knows how much air a block wants.
 *
 * Flutter source: lib/core/widgets/sdui/sdui_section_builder.dart
 */

import { View } from 'react-native';
import type { SduiSection } from '@skkuverse/shared';
import { ButtonGrid } from './widgets/ButtonGrid';
import { SectionTitle } from './widgets/SectionTitle';
import { Notice } from './widgets/Notice';
import { Banner } from './widgets/Banner';

function renderSection(section: SduiSection): React.ReactNode {
  switch (section.type) {
    case 'button_grid':
      return <ButtonGrid key={section.id} section={section} />;

    case 'section_title':
      return <SectionTitle key={section.id} section={section} />;

    case 'notice':
      return <Notice key={section.id} section={section} />;

    case 'banner':
      return <Banner key={section.id} section={section} />;

    case 'spacer':
      return <View key={section.id} style={{ height: section.height }} />;

    case 'unknown':
      // Unknown types render nothing — backward compatibility
      return null;

    default: {
      // Exhaustiveness check — TypeScript error if a new type is unhandled
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

interface SduiSectionListProps {
  sections: SduiSection[];
}

export function SduiSectionList({ sections }: SduiSectionListProps) {
  return <>{sections.map(renderSection)}</>;
}
