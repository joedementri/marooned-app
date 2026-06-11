import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { GameParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import RosterScreen from '../screens/RosterScreen';
import CastawayDetailScreen from '../screens/CastawayDetailScreen';
import ConvoScreen from '../screens/ConvoScreen';
import IslandScreen from '../screens/IslandScreen';
import RewardScreen from '../screens/RewardScreen';
import ImmunityScreen from '../screens/ImmunityScreen';
import CouncilScreen from '../screens/CouncilScreen';
import EndDayScreen from '../screens/EndDayScreen';
import FinalTribalScreen from '../screens/FinalTribalScreen';
import WinnerScreen from '../screens/WinnerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RedemptionIslandScreen from '../screens/RedemptionIslandScreen';
import EdgeScreen from '../screens/EdgeScreen';
import IntelScreen from '../screens/IntelScreen';

const Stack = createStackNavigator<GameParamList>();

export default function GameNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Roster" component={RosterScreen} />
      <Stack.Screen name="CastawayDetail" component={CastawayDetailScreen} />
      <Stack.Screen name="Convo" component={ConvoScreen} />
      <Stack.Screen name="Island" component={IslandScreen} />
      <Stack.Screen name="Reward" component={RewardScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Immunity" component={ImmunityScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Council" component={CouncilScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EndDay" component={EndDayScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="FinalTribal" component={FinalTribalScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Winner" component={WinnerScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="RedemptionIsland" component={RedemptionIslandScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Edge" component={EdgeScreen} />
      <Stack.Screen name="Intel" component={IntelScreen} />
    </Stack.Navigator>
  );
}