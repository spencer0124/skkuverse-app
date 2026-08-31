import { forwardRef, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sheet, type SheetRef } from '@skkuverse/sds';
import { BellRingingIcon } from 'phosphor-react-native';
import { Button, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  SdsSpacing,
  useAuthStore,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { setMasterEnabled } from '@/services/firestore-notifications';
import { useEnableNotificationsFlow } from '../hooks/useEnableNotificationsFlow';

/**
 * Bottom sheet shown on NotificationSettingsScreen entry when permission is
 * `denied` or `notDetermined`. Auto-marks the session-dismissed flag via
 * BottomSheetModal's `onDismiss` so a programmatic close (after grant) and
 * a backdrop tap (user skip) both prevent re-prompting in the same session.
 *
 * Granting here also flips master intent ON (`setMasterEnabled(uid, true)`)
 * — tapping "알림 켜기" is the explicit signal that the user wants notifications.
 */
export const EnableNotificationsSheet = forwardRef<SheetRef>(
  function EnableNotificationsSheet(_, parentRef) {
    const { t } = useT();
    const uid = useAuthStore((s) => s.uid);
    const setDismissed = useNotificationStore(
      (s) => s.setEnableSheetDismissedThisSession,
    );

    // Local ref so we can call dismiss() from inside (post-grant), while
    // still forwarding all BottomSheetModal methods to the parent.
    const sheetRef = useRef<SheetRef>(null);
    const setRefs = useCallback(
      (node: SheetRef | null) => {
        sheetRef.current = node;
        if (typeof parentRef === 'function') parentRef(node);
        else if (parentRef) parentRef.current = node;
      },
      [parentRef],
    );

    const { handleEnable } = useEnableNotificationsFlow({
      onResolved: () => sheetRef.current?.dismiss?.(),
      additionalOnGranted: uid ? () => setMasterEnabled(uid, true) : undefined,
    });

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'stuck', detent: 'small' }}
        onDismiss={() => setDismissed(true)}
      >
        <Sheet.View style={styles.content}>
          <View style={styles.iconCircle}>
            <BellRingingIcon size={40} color={SdsColors.green500} weight="fill" />
          </View>
          <Txt
            typography="t2"
            fontWeight="bold"
            color={SdsColors.grey900}
            style={styles.title}
          >
            {t('notifications.enableSheetTitle')}
          </Txt>
          <Txt
            typography="t6"
            color={SdsColors.grey500}
            style={styles.description}
          >
            {t('notifications.enableSheetDescription')}
          </Txt>
          <View style={styles.ctaWrap}>
            <Button
              type="primary"
              size="big"
              display="block"
              onPress={handleEnable}
            >
              {t('notifications.enableSheetCta')}
            </Button>
          </View>
        </Sheet.View>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.xl,
    paddingTop: SdsSpacing.lg,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SdsColors.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SdsSpacing.lg,
  },
  title: {
    marginBottom: SdsSpacing.sm,
  },
  description: {
    marginBottom: SdsSpacing.xl,
  },
  ctaWrap: {
    marginTop: 'auto',
  },
});
