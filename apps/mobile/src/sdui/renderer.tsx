/**
 * SDUI Section Renderer — maps section types to React Native components.
 *
 * Exhaustive switch on `section.type` with TypeScript `never` check at
 * the default case, ensuring compile-time errors when new section types
 * are added to the union but not handled here.
 *
 * Flutter source: lib/core/widgets/sdui/sdui_section_builder.dart
 */

import { View } from 'react-native';
import type { SduiSection } from '@skkuuniverse/shared';
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
