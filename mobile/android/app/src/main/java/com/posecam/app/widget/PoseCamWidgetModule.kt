package com.posecam.app.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.posecam.app.specs.NativePoseCamWidgetSpec

/** TurboModule `PoseCamWidget` (spec: src/native/NativePoseCamWidget.ts). */
class PoseCamWidgetModule(reactContext: ReactApplicationContext) :
  NativePoseCamWidgetSpec(reactContext) {

  override fun getName(): String = NAME

  override fun configure(serverUrl: String, token: String) {
    val context = reactApplicationContext
    WidgetStore.saveCredentials(context, serverUrl, token)
    if (PoseCamWidgetProvider.hasWidgets(context)) {
      WidgetScheduler.schedulePeriodic(context)
      WidgetScheduler.refreshNow(context)
    }
  }

  override fun refresh() {
    val context = reactApplicationContext
    if (WidgetStore.credentials(context) != null && PoseCamWidgetProvider.hasWidgets(context)) {
      WidgetScheduler.refreshNow(context)
    }
  }

  override fun clear() {
    val context = reactApplicationContext
    WidgetScheduler.cancelAll(context)
    WidgetStore.clearAll(context)
    PoseCamWidgetProvider.updateAll(context)
  }

  override fun requestPinWidget(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }
    val context = reactApplicationContext
    val manager = context.getSystemService(AppWidgetManager::class.java)
    if (manager == null || !manager.isRequestPinAppWidgetSupported) {
      promise.resolve(false)
      return
    }
    val provider = ComponentName(context, PoseCamWidgetProvider::class.java)
    promise.resolve(manager.requestPinAppWidget(provider, null, null))
  }

  companion object {
    const val NAME = "PoseCamWidget"
  }
}
