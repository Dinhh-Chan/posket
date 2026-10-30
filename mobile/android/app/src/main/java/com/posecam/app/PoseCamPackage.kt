package com.posecam.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.posecam.app.widget.PoseCamWidgetModule

/** Registers the app's own TurboModules (codegen specs in src/native). */
class PoseCamPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      PoseCamWidgetModule.NAME -> PoseCamWidgetModule(reactContext)
      ScreenBrightnessModule.NAME -> ScreenBrightnessModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      PoseCamWidgetModule.NAME to turboModuleInfo(PoseCamWidgetModule.NAME, PoseCamWidgetModule::class.java.name),
      ScreenBrightnessModule.NAME to turboModuleInfo(ScreenBrightnessModule.NAME, ScreenBrightnessModule::class.java.name),
    )
  }

  private fun turboModuleInfo(name: String, className: String) =
    ReactModuleInfo(
      name,
      className,
      false, // canOverrideExistingModule
      false, // needsEagerInit
      false, // isCxxModule
      true, // isTurboModule
    )
}
