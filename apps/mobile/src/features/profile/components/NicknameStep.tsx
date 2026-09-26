import { StyleSheet, View } from 'react-native';
import { TextField, Txt } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';
import { NICKNAME_MAX, validateNickname } from '../domain';

interface Props {
  value: string;
  onChange: (nickname: string) => void;
  onSubmit: () => void;
}

export function NicknameStep({ value, onChange, onSubmit }: Props) {
  const { t } = useT();
  const check = validateNickname(value);
  // Too short is where everyone starts, and a lone jamo is a syllable still
  // being typed, so neither is called an error (the button stays off anyway).
  // A character that is neither allowed nor a jamo mid-syllable is wrong
  // whatever the player types next.
  const stray = /[^가-힣a-zA-Z0-9_ㄱ-ㅎㅏ-ㅣ]/.test(value.normalize('NFC').trim());
  const composing = /[ㄱ-ㅎㅏ-ㅣ]/.test(value);
  const error =
    check === 'tooLong'
      ? t('profile.nicknameTooLong')
      : check === 'invalidChars' && (stray || !composing)
        ? t('profile.nicknameInvalid')
        : null;

  return (
    <View style={styles.container}>
      <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {t('profile.nicknameTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {t('profile.nicknameSubtitle')}
      </Txt>
      <TextField
        variant="box"
        value={value}
        onChangeText={onChange}
        placeholder={t('profile.nicknamePlaceholder')}
        help={error ?? t('profile.nicknameHelp')}
        hasError={error !== null}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={NICKNAME_MAX + 4}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { marginTop: 8, marginBottom: 14 },
  subtitle: { marginBottom: 24 },
});
