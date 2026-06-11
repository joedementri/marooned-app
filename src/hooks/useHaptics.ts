import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

// Wraps expo-haptics and gates all feedback behind the soundEnabled setting.
// (Haptics are treated as part of the sound experience.)
export function useHaptics() {
  const soundEnabled = useSettingsStore(s => s.soundEnabled);

  const light = useCallback(() => {
    if (!soundEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [soundEnabled]);

  const medium = useCallback(() => {
    if (!soundEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [soundEnabled]);

  const heavy = useCallback(() => {
    if (!soundEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [soundEnabled]);

  const success = useCallback(() => {
    if (!soundEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [soundEnabled]);

  const warning = useCallback(() => {
    if (!soundEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [soundEnabled]);

  const error = useCallback(() => {
    if (!soundEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, [soundEnabled]);

  return { light, medium, heavy, success, warning, error };
}
