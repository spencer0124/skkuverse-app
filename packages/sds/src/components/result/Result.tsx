/**
 * Result — action result / status feedback screen.
 *
 * Compound: Result.Button
 *
 * Usage:
 *   <Result
 *     figure={<Txt typography="t1">✅</Txt>}
 *     title="송금을 완료했어요"
 *     description="10,000원을 홍길동님에게 보냈어요"
 *     button={<Result.Button onPress={goHome}>확인</Result.Button>}
 *   />
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import { Button, type ButtonProps } from '../button';

// ── Types ──

export interface ResultProps {
  /** Visual element above the title (icon/image/emoji). */
  figure?: ReactNode;
  /** Main result title. */
  title: ReactNode;
  /** Detail text below the title. */
  description?: ReactNode;
  /** Action button(s) below description. Use Result.Button. */
  button?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export interface ResultButtonProps extends Omit<ButtonProps, 'size' | 'display'> {
  children: ReactNode;
}

// ── Result.Button ──

function ResultButton({ children, ...rest }: ResultButtonProps) {
  return (
    <Button size="large" display="block" {...rest}>
      {children}
    </Button>
  );
}

// ── Result ──

function ResultRoot({
  figure,
  title,
  description,
  button,
  style,
}: ResultProps) {
  const adaptive = useAdaptive();

  const renderTitle = () => {
    if (typeof title === 'string') {
      return (
        <Txt
          typography="t4"
          fontWeight="bold"
          color={adaptive.grey900}
          style={[styles.title, { textAlign: 'center' }]}
        >
          {title}
        </Txt>
      );
    }
    return <View style={styles.title}>{title}</View>;
  };

  const renderDescription = () => {
    if (description == null) return null;
    if (typeof description === 'string') {
      return (
        <Txt typography="t6" color={adaptive.grey600} style={[styles.description, { textAlign: 'center' }]}>
          {description}
        </Txt>
      );
    }
    return <View style={styles.description}>{description}</View>;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {figure != null && <View style={styles.figure}>{figure}</View>}
        {renderTitle()}
        {renderDescription()}
      </View>
      {button != null && <View style={styles.buttonArea}>{button}</View>}
    </View>
  );
}

// ── Compound export ──

export const Result = Object.assign(ResultRoot, {
  Button: ResultButton,
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  figure: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
  },
  description: {},
  buttonArea: {
    marginTop: 24,
    width: '100%',
  },
});
