import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';

export default function App() {
  const [loaded] = useFonts({
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    JetBrainsMono_600SemiBold,
  });

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}