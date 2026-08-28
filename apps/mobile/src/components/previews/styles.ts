import { StyleSheet, type ViewStyle } from 'react-native';

/**
 * Shared chrome for the mock cards rendered on pre-sign-in surfaces (the
 * first-launch intro and the notices tab gate).
 *
 * These are deliberately plain hex values rather than SdsColors: the deep green
 * `#1f3d2e` predates the token set and is already hardcoded across
 * OnboardingLanding, HomeOnboardingGateCard and CampusCard. Introducing a token
 * for it belongs in a separate design-system pass, not here — this file at
 * least gives the value one name.
 */
export const previewBrand = {
  green: '#1f3d2e',
  greenTint: '#f0f7f4',
  border: '#e5e5e5',
  ink: '#000000',
  body: '#2c2c2c',
  muted: '#9a9a9a',
} as const;

/** The white card the previews sit in — hairline border plus a soft lift. */
export const previewCard: ViewStyle = {
  width: '100%',
  backgroundColor: '#FFFFFF',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: previewBrand.border,
  borderRadius: 16,
  padding: 16,
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};
