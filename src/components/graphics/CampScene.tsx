import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import PalmSilhouette from './PalmSilhouette';
import WaveBand from './WaveBand';
import FirePit from './FirePit';
import StarField from './StarField';
import { C } from '../../tokens/colors';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

interface Props {
  timeOfDay?: TimeOfDay;
  height?: number;
}

// [skyTop, skyBottom, accentColor]
const SKY: Record<TimeOfDay, [string, string, string]> = {
  dawn:  [C.nightMid, C.torch,      C.sun],
  day:   [C.oceanLight, C.sand,     C.sun],
  dusk:  [C.night, C.coral,         C.torch],
  night: [C.night, C.nightMid,      C.oceanLight],
};

export default function CampScene({ timeOfDay = 'day', height = 200 }: Props) {
  const { width } = useWindowDimensions();
  const [skyTop, skyBot, accent] = SKY[timeOfDay];
  const isNight = timeOfDay === 'night';
  const showStar = timeOfDay === 'night' || timeOfDay === 'dusk';

  return (
    <View style={{ height, overflow: 'hidden' }}>
      {/* Sky gradient + ground */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={skyTop} />
            <Stop offset="1" stopColor={skyBot} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#sky)" />

        {/* Sun or moon */}
        {!isNight && (
          <Circle
            cx={width * 0.72}
            cy={height * 0.22}
            r={height * 0.1}
            fill={accent}
            opacity={0.85}
          />
        )}
        {isNight && (
          <Circle
            cx={width * 0.75}
            cy={height * 0.2}
            r={height * 0.07}
            fill={C.bone}
            opacity={0.9}
          />
        )}

        {/* Ground hill */}
        <Path
          d={`M0,${height * 0.72} Q${width * 0.22},${height * 0.58} ${width * 0.5},${height * 0.66} Q${width * 0.78},${height * 0.74} ${width},${height * 0.62} L${width},${height} L0,${height} Z`}
          fill={C.palmDeep}
        />
      </Svg>

      {/* Stars overlay (night / dusk) */}
      {showStar && <StarField count={50} seed={7} />}

      {/* Left palm */}
      <View style={{ position: 'absolute', left: -4, bottom: height * 0.22 }}>
        <PalmSilhouette height={height * 0.72} color={C.palmDeep} />
      </View>

      {/* Right palm (mirrored) */}
      <View style={{ position: 'absolute', right: -4, bottom: height * 0.16 }}>
        <PalmSilhouette height={height * 0.62} color={C.palmDeep} flip />
      </View>

      {/* Fire centered on the hill */}
      <View style={{ position: 'absolute', bottom: height * 0.22, left: 0, right: 0, alignItems: 'center' }}>
        <FirePit size={height * 0.18} />
      </View>

      {/* Ocean wave at the very bottom */}
      <View style={{ position: 'absolute', bottom: 0 }}>
        <WaveBand color={C.oceanDeep} height={height * 0.14} />
      </View>
    </View>
  );
}
