import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop, G } from 'react-native-svg';
import StarField from './StarField';
import FirePit from './FirePit';
import { initials } from '../../data/roster';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

export interface Attendee { id: number; name: string; color: string; }

interface Props {
  attendees: Attendee[];
  snuffedId: number | null;
  height?: number;
}

// Night-time tribal council backdrop in the camp-scene silhouette idiom: one torch
// per attendee behind a central fire pit. When `snuffedId` is set, that person's
// torch is extinguished with a rising smoke wisp.
export default function TribalCouncilScene({ attendees, snuffedId, height = 220 }: Props) {
  const { width } = useWindowDimensions();
  const torchY = height * 0.34;
  const postBottom = height * 0.74;
  const flameH = 24;

  const positions = attendees.map((a, i) => ({
    a,
    x: (width / (attendees.length + 1)) * (i + 1),
  }));
  const snuffed = positions.find(p => p.a.id === snuffedId) ?? null;

  const smoke = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (snuffedId != null) {
      smoke.setValue(0);
      Animated.timing(smoke, { toValue: 1, duration: 1300, useNativeDriver: true }).start();
    }
  }, [snuffedId, smoke]);

  return (
    <View style={[styles.root, { width, height }]}>
      <View style={StyleSheet.absoluteFill}>
        <StarField count={36} seed={7} />
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.night} />
            <Stop offset="1" stopColor={C.nightMid} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />

        {/* canopy silhouette */}
        <Path d={`M0 ${height * 0.16} Q ${width * 0.25} ${height * 0.02} ${width * 0.5} ${height * 0.14} Q ${width * 0.75} ${height * 0.02} ${width} ${height * 0.16} L ${width} 0 L 0 0 Z`} fill="#0a0f1e" />

        {/* platform */}
        <Rect x={0} y={postBottom + 6} width={width} height={height - postBottom} fill="#160e04" />
        <Rect x={0} y={postBottom + 6} width={width} height={3} fill="#2e1f0e" />

        {/* torches */}
        {positions.map(({ a, x }) => {
          const isSnuffed = a.id === snuffedId;
          return (
            <G key={a.id}>
              {/* post */}
              <Rect x={x - 3} y={torchY} width={6} height={postBottom - torchY} rx={2} fill="#5c3a1e" />
              {/* color band */}
              <Rect x={x - 6} y={torchY + 4} width={12} height={4} rx={2} fill={a.color} />
              {/* living flame (snuffed one is drawn via the animated overlay) */}
              {!isSnuffed && (
                <G>
                  <Path d={flamePath(x, torchY, 11, flameH)} fill={C.torch} />
                  <Path d={flamePath(x, torchY, 7, flameH * 0.7)} fill={C.sun} />
                </G>
              )}
            </G>
          );
        })}
      </Svg>

      {/* central fire */}
      <View style={[styles.fire, { left: width / 2 - 26, top: postBottom - 56 }]}>
        <FirePit size={46} />
      </View>

      {/* initials tags */}
      {positions.map(({ a, x }) => (
        <Text key={a.id} style={[styles.tag, { left: x - 16, top: postBottom + 8, color: a.id === snuffedId ? C.inkSoft : C.bone }]} numberOfLines={1}>
          {initials(a.name)}
        </Text>
      ))}

      {/* snuff smoke wisp */}
      {snuffed && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.smoke,
            {
              left: snuffed.x - 5,
              top: torchY - flameH,
              opacity: smoke.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.9, 0.5, 0] }),
              transform: [{ translateY: smoke.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) }],
            },
          ]}
        />
      )}
    </View>
  );
}

function flamePath(cx: number, baseY: number, w: number, h: number): string {
  const top = baseY - h;
  return `M ${cx} ${baseY} Q ${cx - w} ${baseY - h * 0.5} ${cx - w * 0.4} ${baseY - h * 0.7} Q ${cx - w * 0.2} ${top} ${cx} ${top} Q ${cx + w * 0.2} ${top} ${cx + w * 0.4} ${baseY - h * 0.7} Q ${cx + w} ${baseY - h * 0.5} ${cx} ${baseY} Z`;
}

const styles = StyleSheet.create({
  root:  { overflow: 'hidden', backgroundColor: C.night },
  fire:  { position: 'absolute' },
  tag:   { position: 'absolute', width: 32, textAlign: 'center', fontSize: 9, fontFamily: F.mono, letterSpacing: 0.5 },
  smoke: { position: 'absolute', width: 10, height: 22, borderRadius: 5, backgroundColor: '#9aa0a6' },
});
