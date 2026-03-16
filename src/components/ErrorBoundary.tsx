import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {hasError: false, message: ''};

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, message: error.message ?? 'Unknown error'};
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.label}>SOMETHING WENT WRONG</Text>
          <Text style={styles.message}>{this.state.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 3,
    color: '#f06464',
    marginBottom: 16,
  },
  message: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#555550',
    textAlign: 'center',
  },
});
