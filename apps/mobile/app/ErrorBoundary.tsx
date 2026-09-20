import React, { ErrorInfo, PropsWithChildren } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { ThemeAwareView } from '@/components/ui/ThemeAwareView';
import { reportDiagnostic } from '@/utils/diagnostics';
import { useI18n } from '@/utils/i18n';

type ErrorBoundaryProps = PropsWithChildren & {
  t: ReturnType<typeof useI18n>['t'];
};

type ErrorBoundaryState = {
  error: Error | null;
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportDiagnostic(error, {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="always">
          <ThemeAwareText style={[styles.alignCenter, styles.largeHeading]}>
            {this.props.t('errors.errorBoundaryTitle')}
          </ThemeAwareText>
          <ThemeAwareText style={[styles.alignCenter, styles.smallHeading]}>
            {this.props.t('errors.errorBoundaryMessage')}{' '}
          </ThemeAwareText>
          <ThemeAwareText>{this.state.error?.message}</ThemeAwareText>
          <ThemeAwareText style={[styles.alignCenter, styles.smallHeading]}>
            {this.props.t('errors.errorBoundaryStack')}{' '}
          </ThemeAwareText>
          <ThemeAwareView style={styles.paddingBottom}>
            <ThemeAwareText>
              {this.props.t('errors.errorBoundaryStack')}{' '}
              {this.state.error?.stack}
            </ThemeAwareText>
          </ThemeAwareView>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

export function DiagnosticErrorBoundary({ children }: PropsWithChildren) {
  const { t } = useI18n();

  return <ErrorBoundary t={t}>{children}</ErrorBoundary>;
}

const styles = StyleSheet.create({
  alignCenter: {
    textAlign: 'center',
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  smallHeading: {
    fontSize: 16,
    fontWeight: '900',
  },
  largeHeading: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 10,
  },
  paddingBottom: {
    paddingBottom: 100,
  },
});
