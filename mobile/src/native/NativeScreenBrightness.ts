import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Codegen spec: window brightness override used by the front-camera screen flash. */
export interface Spec extends TurboModule {
  /** true = force maximum brightness for the current window, false = restore the system value. */
  setMaxBrightness(enabled: boolean): void;
}

export default TurboModuleRegistry.get<Spec>('PoseCamScreenBrightness');
