import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radii, scoreColor } from '../theme';

export function ScoreBadge({
  score,
  ready,
}: {
  score: number;
  ready: boolean;
}) {
  const color = scoreColor(score);
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      {ready ? (
        <Text style={[styles.check, { color }]}>✓</Text>
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.badgeText, { color }]}>{score}%</Text>
    </View>
  );
}

export function HintPills({ hints }: { hints: string[] }) {
  if (hints.length === 0) {
    return null;
  }
  return (
    <View style={styles.hints}>
      {hints.map((hint, i) => (
        <View
          key={`${i}-${hint}`}
          style={[styles.hint, i === 0 && styles.hintPrimary]}
        >
          <Text style={styles.hintText} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SoftMessage({ text }: { text: string }) {
  return (
    <View style={styles.soft}>
      <Text style={styles.softText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

/** Big pulsing 3-2-1 number in the middle of the viewfinder. */
export function Countdown({ value }: { value: number }) {
  const scale = useRef(new Animated.Value(1.4)).current;
  useEffect(() => {
    scale.setValue(1.4);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
    }).start();
  }, [value, scale]);
  return (
    <View style={styles.countdownWrap} pointerEvents="none">
      <Animated.Text style={[styles.countdown, { transform: [{ scale }] }]}>
        {value}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.glass,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 18, fontWeight: '800' },
  check: { fontSize: 16, fontWeight: '800' },
  hints: { alignItems: 'center', gap: 6 },
  hint: {
    backgroundColor: colors.glass,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  hintPrimary: { backgroundColor: 'rgba(0,0,0,0.72)' },
  hintText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  soft: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  softText: {
    color: '#E5E5EA',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  countdownWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    color: colors.accent,
    fontSize: 120,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 12,
  },
});
