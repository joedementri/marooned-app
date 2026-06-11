import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootParamList } from './types';

import LoadingScreen from '../screens/LoadingScreen';
import MainMenuScreen from '../screens/MainMenuScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NewGameSetupScreen from '../screens/NewGameSetupScreen';
import GameNavigator from './GameNavigator';
import MinigameDebugScreen from '../screens/MinigameDebugScreen';

const Stack = createStackNavigator<RootParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Loading" component={LoadingScreen} />
        <Stack.Screen name="MainMenu" component={MainMenuScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="NewGameSetup" component={NewGameSetupScreen} />
        <Stack.Screen name="Game" component={GameNavigator} />
        <Stack.Screen name="MinigameDebug" component={MinigameDebugScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}