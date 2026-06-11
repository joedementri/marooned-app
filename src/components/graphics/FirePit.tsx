import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { C } from '../../tokens/colors';

interface Props {
  size?: number;
}

export default function FirePit({ size = 40 }: Props) {
  const flicker = useSharedValue(1);

  useEffect(() => {
    flicker.value = withRepeat(
      withTiming(0.82, { duration: 380, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flicker.value }, { scaleX: 0.94 + flicker.value * 0.06 }],
    transformOrigin: 'bottom',
  }));

  const fw = size;
  const fh = size * 1.5;

  return (
    <View style={{ width: fw, alignItems: 'center' }}>
      <Animated.View style={[{ transformOrigin: 'bottom center' }, animStyle]}>
        <Svg width={fw} height={fh} viewBox="0 0 40 60">
          {/* Outer flame */}
          <Path
            d="M20,2 Q30,14 30,28 Q30,44 20,54 Q10,44 10,28 Q10,14 20,2 Z"
            fill={C.torch}
          />
          {/* Mid flame */}
          <Path
            d="M20,12 Q27,22 27,32 Q27,42 20,50 Q13,42 13,32 Q13,22 20,12 Z"
            fill={C.sun}
          />
          {/* Core */}
          <Path
            d="M20,22 Q24,28 23,35 Q20,38 17,35 Q16,28 20,22 Z"
            fill={C.bone}
            opacity={0.85}
          />
        </Svg>
      </Animated.View>
      {/* Log base */}
      <Svg width={fw} height={12} viewBox="0 0 40 12">
        <Ellipse cx={20} cy={7} rx={18} ry={5} fill={C.inkMid} />
        <Ellipse cx={20} cy={5} rx={18} ry={4} fill={C.ink} />
      </Svg>
    </View>
  );
}
