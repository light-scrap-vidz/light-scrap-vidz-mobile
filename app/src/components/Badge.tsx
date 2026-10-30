import { View, Text, StyleSheet } from 'react-native';
import { radius } from '@/theme';

interface BadgeProps {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function Badge({ label, color, bgColor, borderColor }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
});
