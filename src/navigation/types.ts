import type { NavigatorScreenParams } from '@react-navigation/native';

export type GameParamList = {
  Home: undefined;
  Roster: undefined;
  CastawayDetail: { castawayId: number };
  Convo: { castawayId: number };
  Island: undefined;
  Reward: undefined;
  Immunity: undefined;
  Council: undefined;
  EndDay: undefined;
  FinalTribal: undefined;
  Winner: { winnerId: number; tally: Record<number, number> };
  Settings: undefined;
  RedemptionIsland: undefined;
  Edge: undefined;
  Intel: undefined;
};

export type RootParamList = {
  Loading: undefined;
  MainMenu: undefined;
  Settings: undefined;
  NewGameSetup: { slotIndex: number };
  Game: NavigatorScreenParams<GameParamList>;
  MinigameDebug: undefined;
};