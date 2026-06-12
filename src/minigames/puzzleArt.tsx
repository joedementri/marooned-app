import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { C } from '../tokens/colors';

// Tribal scenes for the slide puzzle, drawn in a fixed 300x300 space. Each tile
// of the board renders the whole scene through an offset viewBox, so these are
// plain element fragments (no <Svg> wrapper). Scenes are deliberately
// asymmetric — every region needs landmarks so sliced tiles are tellable apart.

export const ART = 300;

export interface PuzzleScene {
  key: string;
  name: string;
  render: () => React.ReactNode;
}

const LOG_BROWN = '#6b4226';
const LOG_DARK = '#4e2f1a';
const SHELL = '#3e7d4f';

function tikiMask(): React.ReactNode {
  return (
    <G key="tiki">
      {/* backdrop: sand with woven corners */}
      <Rect x={0} y={0} width={300} height={300} fill={C.sand} />
      <Path d="M 0 0 L 70 0 L 0 70 Z" fill={C.palm} opacity={0.5} />
      <Path d="M 300 300 L 230 300 L 300 230 Z" fill={C.coral} opacity={0.5} />
      <Circle cx={262} cy={40} r={22} fill={C.sun} />
      {[0, 45, 90, 135].map(a => (
        <Line key={a} x1={262 - 32 * Math.cos((a * Math.PI) / 180)} y1={40 - 32 * Math.sin((a * Math.PI) / 180)}
          x2={262 + 32 * Math.cos((a * Math.PI) / 180)} y2={40 + 32 * Math.sin((a * Math.PI) / 180)}
          stroke={C.sun} strokeWidth={3} />
      ))}
      {/* mask body */}
      <Path d="M 150 38 Q 232 50 232 150 Q 232 244 150 262 Q 68 244 68 150 Q 68 50 150 38 Z"
        fill={LOG_BROWN} stroke={C.ink} strokeWidth={4} />
      {/* brow */}
      <Path d="M 88 110 Q 150 78 212 110" stroke={C.ink} strokeWidth={6} fill="none" />
      {/* eyes — different shapes left vs right */}
      <Circle cx={113} cy={134} r={20} fill={C.bone} stroke={C.ink} strokeWidth={3} />
      <Circle cx={113} cy={134} r={7} fill={C.ink} />
      <Rect x={168} y={116} width={38} height={34} rx={6} fill={C.bone} stroke={C.ink} strokeWidth={3} />
      <Rect x={182} y={128} width={11} height={11} fill={C.ink} />
      {/* nose */}
      <Polygon points="150,148 138,188 162,188" fill={C.coral} stroke={C.ink} strokeWidth={2} />
      {/* mouth with teeth */}
      <Rect x={104} y={204} width={92} height={26} rx={8} fill={C.ink} />
      {[112, 130, 148, 166].map(x => (
        <Rect key={x} x={x} y={207} width={10} height={9} fill={C.bone} />
      ))}
      {/* cheek tattoos */}
      <Path d="M 80 168 q 10 8 0 18 q -10 8 0 18" stroke={C.bone} strokeWidth={3} fill="none" />
      <Circle cx={218} cy={176} r={5} fill={C.sun} />
      <Circle cx={218} cy={192} r={5} fill={C.coral} />
      {/* headdress feathers */}
      {[-44, -20, 4, 28].map((dx, i) => (
        <Path key={i} d={`M ${150 + dx} 44 q ${dx * 0.4} -34 ${dx * 0.9} -40`}
          stroke={i % 2 ? C.coral : C.palm} strokeWidth={7} fill="none" strokeLinecap="round" />
      ))}
    </G>
  );
}

function islandSunset(): React.ReactNode {
  return (
    <G key="sunset">
      {/* sky bands */}
      <Rect x={0} y={0} width={300} height={70} fill={C.coral} />
      <Rect x={0} y={70} width={300} height={55} fill={C.torch} />
      <Rect x={0} y={125} width={300} height={50} fill={C.sun} />
      {/* sun on the horizon, off-center */}
      <Circle cx={196} cy={175} r={44} fill={C.bone} />
      <Circle cx={196} cy={175} r={34} fill={C.sun} />
      {/* ocean */}
      <Rect x={0} y={175} width={300} height={125} fill={C.oceanDeep} />
      <Rect x={0} y={175} width={300} height={10} fill={C.ocean} />
      <Path d="M 130 196 q 33 8 66 0 q 20 6 40 1" stroke={C.sun} strokeWidth={4} fill="none" opacity={0.8} />
      <Path d="M 60 226 q 26 7 52 0" stroke={C.oceanLight} strokeWidth={3} fill="none" opacity={0.6} />
      <Path d="M 170 258 q 30 8 60 0" stroke={C.oceanLight} strokeWidth={3} fill="none" opacity={0.5} />
      {/* island bump bottom-left */}
      <Path d="M 0 300 L 0 252 Q 56 224 122 252 L 122 300 Z" fill={C.ink} />
      {/* palm tree silhouette */}
      <Path d="M 56 254 Q 50 196 64 168" stroke={C.ink} strokeWidth={9} fill="none" strokeLinecap="round" />
      {[[64, 168, 116, 152], [64, 168, 104, 188], [64, 168, 28, 150], [64, 168, 16, 184]].map((p, i) => (
        <Path key={i} d={`M ${p[0]} ${p[1]} Q ${(p[0] + p[2]) / 2} ${p[3] - 26} ${p[2]} ${p[3]}`}
          stroke={C.ink} strokeWidth={7} fill="none" strokeLinecap="round" />
      ))}
      {/* birds top-left */}
      <Path d="M 36 40 q 8 -8 16 0 q 8 -8 16 0" stroke={C.ink} strokeWidth={3} fill="none" />
      <Path d="M 70 22 q 6 -6 12 0 q 6 -6 12 0" stroke={C.ink} strokeWidth={2.5} fill="none" />
    </G>
  );
}

function nightTorch(): React.ReactNode {
  return (
    <G key="torch">
      {/* night sky */}
      <Rect x={0} y={0} width={300} height={300} fill={C.night} />
      {/* fixed star scatter (varied sizes, asymmetric) */}
      {[[26, 30, 2.5], [70, 64, 1.6], [120, 26, 2], [250, 80, 2.4], [274, 30, 1.6], [210, 40, 1.8],
        [40, 120, 1.6], [262, 140, 2], [238, 196, 1.5], [24, 210, 1.8]].map((s, i) => (
        <Circle key={i} cx={s[0]} cy={s[1]} r={s[2]} fill={C.bone} opacity={0.9} />
      ))}
      {/* moon crescent top-right */}
      <Circle cx={250} cy={52} r={20} fill={C.bone} />
      <Circle cx={258} cy={46} r={18} fill={C.night} />
      {/* glow */}
      <Circle cx={150} cy={130} r={78} fill={C.torch} opacity={0.16} />
      <Circle cx={150} cy={130} r={48} fill={C.sun} opacity={0.18} />
      {/* torch pole */}
      <Rect x={142} y={150} width={16} height={120} rx={6} fill={LOG_BROWN} stroke={LOG_DARK} strokeWidth={2} />
      <Line x1={142} y1={186} x2={158} y2={178} stroke={LOG_DARK} strokeWidth={3} />
      <Line x1={142} y1={226} x2={158} y2={218} stroke={LOG_DARK} strokeWidth={3} />
      {/* head wrap */}
      <Rect x={134} y={138} width={32} height={20} rx={6} fill={LOG_DARK} />
      <Line x1={134} y1={148} x2={166} y2={148} stroke={C.sand} strokeWidth={2} opacity={0.5} />
      {/* flame */}
      <Path d="M 150 60 Q 178 96 168 124 Q 162 142 150 144 Q 138 142 132 124 Q 122 96 150 60 Z" fill={C.torch} />
      <Path d="M 150 86 Q 164 106 158 124 Q 154 134 150 136 Q 146 134 142 124 Q 136 106 150 86 Z" fill={C.sun} />
      <Path d="M 150 106 Q 156 116 153 126 Q 151 131 150 132 Q 149 131 147 126 Q 144 116 150 106 Z" fill={C.bone} />
      {/* ground + stones, uneven */}
      <Path d="M 0 270 Q 80 256 160 270 Q 230 282 300 268 L 300 300 L 0 300 Z" fill={C.ink} />
      <Ellipse cx={64} cy={276} rx={18} ry={8} fill={C.inkMid} />
      <Ellipse cx={226} cy={284} rx={24} ry={9} fill={C.inkMid} />
      <Ellipse cx={130} cy={288} rx={12} ry={6} fill={C.inkSoft} opacity={0.7} />
    </G>
  );
}

function seaTurtle(): React.ReactNode {
  return (
    <G key="turtle">
      {/* water */}
      <Rect x={0} y={0} width={300} height={300} fill={C.ocean} />
      <Rect x={0} y={0} width={300} height={80} fill={C.oceanLight} opacity={0.4} />
      {/* light rays top-left */}
      <Polygon points="0,0 60,0 20,120" fill={C.bone} opacity={0.18} />
      <Polygon points="60,0 110,0 60,140" fill={C.bone} opacity={0.12} />
      {/* bubbles trailing up-right */}
      {[[232, 64, 6], [248, 44, 4], [240, 26, 3], [260, 84, 5], [270, 60, 3]].map((b, i) => (
        <Circle key={i} cx={b[0]} cy={b[1]} r={b[2]} fill={C.bone} opacity={0.55} stroke={C.oceanLight} strokeWidth={1} />
      ))}
      {/* seaweed bottom-right */}
      <Path d="M 268 300 q -10 -28 4 -52 q 12 -22 2 -46" stroke={C.palm} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M 288 300 q 8 -24 -4 -44 q -10 -20 0 -40" stroke={C.palmDeep} strokeWidth={6} fill="none" strokeLinecap="round" />
      {/* sandy floor */}
      <Path d="M 0 286 Q 90 272 180 288 Q 240 296 300 288 L 300 300 L 0 300 Z" fill={C.sandMid} />
      {/* turtle diagonal */}
      <G rotation={-18} origin="150,165">
        {/* flippers */}
        <Path d="M 96 130 Q 56 96 42 110 Q 56 138 96 152 Z" fill={SHELL} stroke={C.ink} strokeWidth={2.5} />
        <Path d="M 96 200 Q 58 226 50 214 Q 62 188 98 178 Z" fill={SHELL} stroke={C.ink} strokeWidth={2.5} />
        <Path d="M 204 130 Q 244 98 256 112 Q 244 140 204 152 Z" fill={SHELL} stroke={C.ink} strokeWidth={2.5} />
        <Path d="M 204 200 Q 240 224 248 212 Q 238 188 202 178 Z" fill={SHELL} stroke={C.ink} strokeWidth={2.5} />
        {/* shell */}
        <Ellipse cx={150} cy={165} rx={62} ry={52} fill={C.palmDeep} stroke={C.ink} strokeWidth={4} />
        {/* shell plates */}
        <Polygon points="150,123 178,143 168,176 132,176 122,143" fill={SHELL} stroke={C.ink} strokeWidth={2.5} />
        <Path d="M 150 123 L 150 110 M 178 143 L 196 132 M 168 176 L 184 192 M 132 176 L 116 192 M 122 143 L 104 132"
          stroke={C.ink} strokeWidth={2.5} />
        {/* head */}
        <Circle cx={150} cy={98} r={20} fill={SHELL} stroke={C.ink} strokeWidth={3} />
        <Circle cx={143} cy={93} r={3.4} fill={C.ink} />
        <Circle cx={157} cy={93} r={3.4} fill={C.ink} />
      </G>
      {/* small fish bottom-left */}
      <G>
        <Ellipse cx={56} cy={244} rx={16} ry={8} fill={C.sun} stroke={C.ink} strokeWidth={2} />
        <Polygon points="40,244 28,236 28,252" fill={C.sun} stroke={C.ink} strokeWidth={2} />
        <Circle cx={64} cy={242} r={2} fill={C.ink} />
      </G>
    </G>
  );
}

export const PUZZLE_SCENES: PuzzleScene[] = [
  { key: 'tikiMask', name: 'TIKI MASK', render: tikiMask },
  { key: 'sunset', name: 'ISLAND SUNSET', render: islandSunset },
  { key: 'torch', name: 'NIGHT TORCH', render: nightTorch },
  { key: 'turtle', name: 'SEA TURTLE', render: seaTurtle },
];
