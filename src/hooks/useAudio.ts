import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSettingsStore } from '../store/settingsStore';

export type MusicContext = 'camp' | 'council';
export type SfxKey = 'parchment' | 'win' | 'lose' | 'torch' | 'idol';

// Static requires resolved at bundle time
const MUSIC_SOURCES = {
  camp:    require('../../assets/sounds/music-camp.mp3'),
  council: require('../../assets/sounds/music-council.mp3'),
} as const;

const SFX_SOURCES = {
  parchment: require('../../assets/sounds/sfx-parchment.mp3'),
  win:       require('../../assets/sounds/sfx-win.mp3'),
  lose:      require('../../assets/sounds/sfx-lose.mp3'),
  torch:     require('../../assets/sounds/sfx-torch.mp3'),
  // Placeholder stinger — swap for a dedicated sfx-idol.mp3 when one exists.
  idol:      require('../../assets/sounds/sfx-win.mp3'),
} as const;

async function configureAudio() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  } catch {}
}

// useAudio manages background music for a screen and provides one-shot SFX.
// Pass a musicContext to auto-play looping music on mount; omit for SFX-only.
// For focus-aware screens (HomeScreen), use startMusic/stopMusic with useFocusEffect.
export function useAudio(musicContext?: MusicContext) {
  const musicEnabled = useSettingsStore(s => s.musicEnabled);
  const soundEnabled = useSettingsStore(s => s.soundEnabled);
  const musicRef = useRef<Audio.Sound | null>(null);

  const stopMusic = useCallback(async () => {
    if (!musicRef.current) return;
    try {
      await musicRef.current.stopAsync();
      await musicRef.current.unloadAsync();
    } catch {}
    musicRef.current = null;
  }, []);

  const startMusic = useCallback(async (ctx: MusicContext) => {
    await stopMusic();
    if (!musicEnabled) return;
    try {
      await configureAudio();
      const { sound } = await Audio.Sound.createAsync(
        MUSIC_SOURCES[ctx],
        { shouldPlay: true, isLooping: true, volume: 0.55 },
      );
      musicRef.current = sound;
    } catch {}
  }, [musicEnabled, stopMusic]);

  // Auto-play when musicContext is provided
  useEffect(() => {
    if (!musicContext) return;
    startMusic(musicContext);
    return () => { stopMusic(); };
  }, [musicContext, musicEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const playSfx = useCallback(async (sfx: SfxKey) => {
    if (!soundEnabled) return;
    try {
      await configureAudio();
      const { sound } = await Audio.Sound.createAsync(
        SFX_SOURCES[sfx],
        { shouldPlay: true, volume: 0.8 },
      );
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {}
  }, [soundEnabled]);

  return { playSfx, startMusic, stopMusic };
}
