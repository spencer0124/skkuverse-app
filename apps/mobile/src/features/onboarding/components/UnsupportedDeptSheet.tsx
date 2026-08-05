import { Button, Dialog } from '@skkuverse/sds';
import {
  hasBundledExcludeReasonCopy,
  useT,
  type TabSource,
} from '@skkuverse/shared';

interface Props {
  /** Source the user just tapped — null when sheet is closed. */
  source: TabSource | null;
  /** College-umbrella alternative to recommend. May be null if no umbrella exists. */
  umbrella: TabSource | null;
  onAccept: (umbrella: TabSource) => void;
  onDismiss: () => void;
}

/**
 * Confirmation sheet shown when a user taps an unsupported dept on step 2.
 *
 * Behavior depends on whether a college-umbrella alternative is available:
 *   • umbrella present → "이 학과는 ~. 대신 {umbrella}를 선택할까요?" with two
 *     CTAs ("그렇게 할게요" / "다른 학과 고를게요"). Accepting calls
 *     `onAccept(umbrella)` so the caller can dispatch SET_PRIMARY_DEPT.
 *   • umbrella absent → reason copy only, with a single dismiss button.
 *     Avoids offering a fallback we cannot fulfill.
 *
 * Reason copy priority: server-resolved `excludeReasonText` (crawler SSOT,
 * localized per response language) → bundled i18n for legacy keys (old-server
 * fallback) → sheet stays closed (a key with no copy anywhere has nothing
 * useful to say).
 */
export function UnsupportedDeptSheet({ source, umbrella, onAccept, onDismiss }: Props) {
  const { t, tpl } = useT();
  const serverCopy = source?.excludeReasonText ?? null;
  const rawKey = source?.excludeReason ?? null;
  const bundledKey =
    serverCopy === null && hasBundledExcludeReasonCopy(rawKey) ? rawKey : null;
  const reasonCopy =
    serverCopy ?? (bundledKey ? t(`onboarding.unsupportedDept.reason.${bundledKey}`) : '');
  const open = source !== null && reasonCopy !== '';
  const description = umbrella
    ? `${reasonCopy}\n${tpl('onboarding.unsupportedDept.alternative', umbrella.name)}`
    : reasonCopy;

  return (
    <Dialog.Confirm
      open={open}
      title={t('onboarding.unsupportedDept.title')}
      description={description}
      leftButton={
        umbrella ? (
          <Button
            type="primary"
            size="medium"
            display="block"
            onPress={() => onAccept(umbrella)}
          >
            {t('onboarding.unsupportedDept.acceptCta')}
          </Button>
        ) : (
          <Button
            style="weak"
            type="dark"
            size="medium"
            display="block"
            onPress={onDismiss}
          >
            {t('onboarding.unsupportedDept.dismissCta')}
          </Button>
        )
      }
      rightButton={
        umbrella ? (
          <Button
            style="weak"
            type="dark"
            size="medium"
            display="block"
            onPress={onDismiss}
          >
            {t('onboarding.unsupportedDept.dismissCta')}
          </Button>
        ) : undefined
      }
      onClose={onDismiss}
    />
  );
}
