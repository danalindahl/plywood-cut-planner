const tintColorLight = '#2E7D32'; // forest green — woodworking vibe
const tintColorDark = '#81C784';

// Colors for piece rectangles in cutting diagrams
export const PIECE_COLORS = [
  '#42A5F5', // blue
  '#EF5350', // red
  '#66BB6A', // green
  '#FFA726', // orange
  '#AB47BC', // purple
  '#26C6DA', // cyan
  '#FFEE58', // yellow
  '#EC407A', // pink
  '#8D6E63', // brown
  '#78909C', // blue-grey
];

export default {
  light: {
    text: '#1a1a1a',
    secondaryText: '#666',
    background: '#f5f5f0',
    card: '#fff',
    border: '#ddd',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    danger: '#d32f2f',
    waste: '#e0e0e0',
  },
  dark: {
    text: '#f5f5f5',
    secondaryText: '#aaa',
    background: '#121212',
    card: '#1e1e1e',
    border: '#333',
    tint: tintColorDark,
    tabIconDefault: '#666',
    tabIconSelected: tintColorDark,
    danger: '#ef5350',
    waste: '#333',
  },
};
