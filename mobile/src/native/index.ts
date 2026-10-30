import NativePoseCamWidget from './NativePoseCamWidget';
import NativeScreenBrightness from './NativeScreenBrightness';

/** Android home-screen widget bridge. No-ops where the native module is absent (iOS, tests). */
export const widget = {
  configure(serverUrl: string, token: string): void {
    try {
      NativePoseCamWidget?.configure(serverUrl, token);
    } catch {
      // The widget is optional; never break the app because of it.
    }
  },
  refresh(): void {
    try {
      NativePoseCamWidget?.refresh();
    } catch {
      // ignore
    }
  },
  clear(): void {
    try {
      NativePoseCamWidget?.clear();
    } catch {
      // ignore
    }
  },
  /** True when the native widget module exists (Android). */
  get available(): boolean {
    return NativePoseCamWidget != null;
  },
  async requestPin(): Promise<boolean> {
    try {
      return (await NativePoseCamWidget?.requestPinWidget()) ?? false;
    } catch {
      return false;
    }
  },
};

export function setMaxBrightness(enabled: boolean): void {
  try {
    NativeScreenBrightness?.setMaxBrightness(enabled);
  } catch {
    // ignore
  }
}
