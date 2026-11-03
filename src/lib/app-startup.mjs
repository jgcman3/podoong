export const startupBackground = '#f7f9fc';
// CSS screen dimensions and scale used by iPhone Home Screen launch images.
export const startupScreens = [
  [320, 568, 2],
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 896, 2],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];
export function appleStartupImages() {
  return startupScreens.flatMap(([width, height, scale]) =>
    ['portrait', 'landscape'].map((orientation) => ({
      url: `/splash/v1/${width}x${height}@${scale}-${orientation}.png`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation})`,
    })),
  );
}
