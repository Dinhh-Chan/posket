import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec of the Android home-screen widget module (Kotlin:
 * android/app/src/main/java/com/posecam/app/widget/PoseCamWidgetModule.kt).
 */
export interface Spec extends TurboModule {
  /** Stores server URL + token for the widget's background refresh and schedules it. */
  configure(serverUrl: string, token: string): void;
  /** Fetches the newest photo from a friend now (one-off background job). */
  refresh(): void;
  /** Forgets credentials, cancels jobs and resets all widgets to the placeholder. */
  clear(): void;
  /**
   * Asks the launcher to pin the widget on the home screen (Android 8+).
   * Resolves false when the launcher does not support it.
   */
  requestPinWidget(): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('PoseCamWidget');
