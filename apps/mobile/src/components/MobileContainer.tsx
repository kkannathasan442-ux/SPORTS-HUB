import React from 'react';
import { StyleSheet, View, ViewStyle, SafeAreaView } from 'react-native';

export interface MobileContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({ children, style }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'center',
  },
});
