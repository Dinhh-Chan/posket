import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pose } from '../pose/types';
import { colors } from '../theme';
import { PoseFigure } from './PoseFigure';

export function DifficultyDots({
  level,
  size = 6,
}: {
  level: number;
  size?: number;
}) {
  return (
    <View style={styles.dots} accessibilityLabel={`Độ khó ${level}/3`}>
      {[1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            { width: size, height: size, borderRadius: size / 2 },
            i <= level ? styles.dotOn : styles.dotOff,
          ]}
        />
      ))}
    </View>
  );
}

export interface PoseCardProps {
  pose: Pose;
  width: number;
  selected?: boolean;
  /** Extra line under the name (e.g. suggestion reason). */
  subtitle?: string;
  onPress: (pose: Pose) => void;
}

function PoseCardImpl({
  pose,
  width,
  selected,
  subtitle,
  onPress,
}: PoseCardProps) {
  const thumb = width;
  return (
    <Pressable
      onPress={() => onPress(pose)}
      accessibilityRole="button"
      accessibilityLabel={`Dáng ${pose.name}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.thumb,
          {
            width: thumb,
            height: thumb,
            borderRadius: Math.round(thumb * 0.18),
          },
          selected && styles.selected,
        ]}
      >
        <PoseFigure pose={pose} size={thumb - 4} guideOpacity={0.55} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {pose.name}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      <DifficultyDots level={pose.difficulty} />
    </Pressable>
  );
}

export const PoseCard = memo(PoseCardImpl);

const styles = StyleSheet.create({
  thumb: {
    backgroundColor: '#0B0B0C',
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selected: { borderColor: colors.accent },
  name: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 6 },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  dots: { flexDirection: 'row', gap: 4, marginTop: 4 },
  dotOn: { backgroundColor: colors.accent },
  dotOff: { backgroundColor: colors.surfaceHigh },
  pressed: { opacity: 0.6 },
});
