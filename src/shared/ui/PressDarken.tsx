import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { pressState, springs } from '@/shared/theme';

interface PressProgress {
  /** 0 at rest, 1 while held. Feed this to `PressDarken`. */
  progress: SharedValue<number>;
  /** Spread onto the `Pressable` that owns the face. */
  pressHandlers: { onPressIn: () => void; onPressOut: () => void };
}

/**
 * The press signal every interactive face in the app shares, so a tap feels the
 * same on a button, a card and a tile.
 *
 * Held presses spring in fast (`snappy`) and release slow (`pop`): the finger is
 * already down by the time the press-in animation would finish, so speed there is
 * free, while the release is the part the eye actually watches.
 *
 * The handlers are rebuilt each render rather than memoised. Wrapping them in
 * `useMemo` means passing `progress` to a hook and then writing to it inside,
 * which `react-hooks/immutability` rejects — correctly, since a shared value's
 * identity is the thing a dependency array is supposed to track. Two closures per
 * render is the cheaper side of that trade, and it is what `Pressable` received
 * from inline arrow props here before this hook existed.
 */
export function usePressProgress(): PressProgress {
  const progress = useSharedValue(0);

  return {
    progress,
    pressHandlers: {
      onPressIn: () => {
        progress.value = withSpring(1, springs.snappy);
      },
      onPressOut: () => {
        progress.value = withSpring(0, springs.pop);
      },
    },
  };
}

interface PressDarkenProps {
  progress: SharedValue<number>;
  /** Must match the radius of the face this covers, or the corners show through. */
  radius: number;
}

/**
 * A tint that fades in over a held face.
 *
 * An overlay rather than an animated `backgroundColor` because the faces it covers
 * are not all flat colours — Home's Play button is a radial gradient, and
 * `experimental_backgroundImage` is not a Reanimated-animatable prop. Darkening
 * from on top works the same over a gradient, an image or a solid fill.
 *
 * Render it as the first child of the face so it paints beneath the label, and give
 * it the face's own radius: it is absolutely positioned, so a face that does not
 * clip would otherwise show square corners under the rounded fill.
 */
export function PressDarken({ progress, radius }: PressDarkenProps) {
  const tint = useAnimatedStyle(() => ({ opacity: progress.value * pressState.opacity }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: pressState.tint, borderRadius: radius },
        tint,
      ]}
    />
  );
}
