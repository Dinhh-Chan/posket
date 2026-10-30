package com.posecam.app

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.posecam.app.specs.NativeScreenBrightnessSpec

/** TurboModule `PoseCamScreenBrightness`: max window brightness for the front-camera screen flash. */
class ScreenBrightnessModule(reactContext: ReactApplicationContext) :
  NativeScreenBrightnessSpec(reactContext) {

  override fun getName(): String = NAME

  override fun setMaxBrightness(enabled: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    UiThreadUtil.runOnUiThread {
      val window = activity.window ?: return@runOnUiThread
      val params = window.attributes
      params.screenBrightness =
        if (enabled) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
        else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
      window.attributes = params
    }
  }

  companion object {
    const val NAME = "PoseCamScreenBrightness"
  }
}
