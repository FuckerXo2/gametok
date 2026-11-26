// The Pixil star: six kite points, each with its right half darkened (logo/star.svg)
import React from 'react';
import Svg, { G, Polygon } from 'react-native-svg';

const COLS = ['#ff2e3f', '#ff8a1a', '#ffd60a', '#12c95a', '#1f7bff', '#a133ff'];

export const PixilStar: React.FC<{ size: number }> = ({ size }) => (
  <Svg width={size} height={size} viewBox="-110 -110 220 220">
    {COLS.map((c, i) => (
      <G key={c} rotation={i * 60} origin="0, 0">
        <Polygon points="0,0 -22.5,-39 0,-100 22.5,-39" fill={c} />
        <Polygon points="0,0 22.5,-39 0,-100" fill="#000" fillOpacity={0.3} />
      </G>
    ))}
  </Svg>
);
