import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SdsColors, SdsTypo, SdsSpacing, SdsRadius } from '@skkuverse/shared';
import { recordError } from '@/services/crashlytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary — catches unhandled JS errors in the React tree.
 *
 * Renders a friendly fallback UI with retry button.
 * In __DEV__, also shows the error message for debugging.
 *
 * Crashlytics: errors reported via recordError() in componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
    recordError(error, errorInfo.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>문제가 발생했어요</Text>
        <Text style={styles.subtitle}>잠시 후 다시 시도해 주세요</Text>
        {__DEV__ && this.state.error && (
          <Text style={styles.debug}>{this.state.error.message}</Text>
        )}
        <Pressable style={styles.button} onPress={this.handleRetry}>
          <Text style={styles.buttonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SdsColors.grey50,
    padding: SdsSpacing.xl,
  },
  title: {
    fontFamily: SdsTypo.t4.fontFamily,
    fontSize: SdsTypo.t4.fontSize,
    lineHeight: SdsTypo.t4.lineHeight,
    fontWeight: SdsTypo.t4.fontWeight,
    color: SdsColors.grey900,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: SdsTypo.t6.fontFamily,
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: SdsTypo.t6.fontWeight,
    color: SdsColors.grey500,
    textAlign: 'center',
    marginTop: SdsSpacing.sm,
  },
  debug: {
    fontFamily: SdsTypo.t7.fontFamily,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: SdsTypo.t7.fontWeight,
    color: SdsColors.red500,
    textAlign: 'center',
    marginTop: SdsSpacing.base,
  },
  button: {
    marginTop: SdsSpacing.xl,
    paddingHorizontal: SdsSpacing.xl,
    paddingVertical: SdsSpacing.md,
    backgroundColor: SdsColors.grey900,
    borderRadius: SdsRadius.md,
  },
  buttonText: {
    fontFamily: SdsTypo.t6.fontFamily,
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
