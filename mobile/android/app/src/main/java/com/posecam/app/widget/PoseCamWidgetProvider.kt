package com.posecam.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.posecam.app.MainActivity
import com.posecam.app.R

/** Home-screen widget: newest photo a friend sent (rounded square + sender name). */
class PoseCamWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    render(context, manager, appWidgetIds)
    if (WidgetStore.credentials(context) != null) {
      WidgetScheduler.schedulePeriodic(context)
      WidgetScheduler.refreshNow(context)
    }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    render(context, manager, intArrayOf(appWidgetId))
  }

  override fun onDisabled(context: Context) {
    // Last widget removed: no need to keep polling.
    WidgetScheduler.cancelAll(context)
  }

  companion object {
    fun widgetIds(context: Context): IntArray =
      AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, PoseCamWidgetProvider::class.java))

    fun hasWidgets(context: Context): Boolean = widgetIds(context).isNotEmpty()

    /** Redraws every widget instance from [WidgetStore]. */
    fun updateAll(context: Context) {
      val ids = widgetIds(context)
      if (ids.isNotEmpty()) render(context, AppWidgetManager.getInstance(context), ids)
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      if (ids.isEmpty()) return
      manager.updateAppWidget(ids, buildViews(context))
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.posecam_widget)
      val loggedIn = WidgetStore.credentials(context) != null
      val photo = if (loggedIn) WidgetStore.photo(context) else null
      val bitmap = photo?.let { loadRounded(context) }

      if (photo != null && bitmap != null) {
        views.setImageViewBitmap(R.id.widget_image, bitmap)
        views.setViewVisibility(R.id.widget_image, View.VISIBLE)
        views.setViewVisibility(R.id.widget_placeholder, View.GONE)
        val label = listOfNotNull(
          photo.senderName.ifBlank { null },
          photo.createdAt?.let { RelativeTime.format(it) },
        ).joinToString(" · ")
        views.setTextViewText(R.id.widget_sender, label)
        views.setViewVisibility(R.id.widget_sender, if (label.isBlank()) View.GONE else View.VISIBLE)
      } else {
        views.setViewVisibility(R.id.widget_image, View.GONE)
        views.setViewVisibility(R.id.widget_sender, View.GONE)
        views.setViewVisibility(R.id.widget_placeholder, View.VISIBLE)
        views.setTextViewText(
          R.id.widget_placeholder,
          context.getString(if (loggedIn) R.string.widget_empty else R.string.widget_logged_out),
        )
      }

      val intent =
        Intent(context, MainActivity::class.java).apply {
          action = Intent.ACTION_MAIN
          addCategory(Intent.CATEGORY_LAUNCHER)
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
        }
      val pending =
        PendingIntent.getActivity(
          context,
          0,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      views.setOnClickPendingIntent(R.id.widget_root, pending)
      return views
    }

    /**
     * Cached photo. From API 31 the widget root clips its children to the rounded
     * background (clipToOutline); before that the bitmap itself gets rounded corners.
     */
    private fun loadRounded(context: Context): Bitmap? {
      val file = WidgetStore.imageFile(context)
      if (!file.exists()) return null
      val source = BitmapFactory.decodeFile(file.absolutePath) ?: return null
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return source
      val side = minOf(source.width, source.height)
      val output = Bitmap.createBitmap(side, side, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(output)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG)
      paint.shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
      val radius = side * 0.12f
      canvas.drawRoundRect(RectF(0f, 0f, side.toFloat(), side.toFloat()), radius, radius, paint)
      return output
    }
  }
}

/** Short Vietnamese relative time for the widget label ("vừa xong", "5 phút", "2 giờ", "hôm qua"). */
internal object RelativeTime {
  fun format(iso: String, nowMillis: Long = System.currentTimeMillis()): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    val millis =
      try {
        java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli()
      } catch (e: Exception) {
        try {
          java.time.Instant.parse(iso).toEpochMilli()
        } catch (e2: Exception) {
          try {
            java.time.LocalDateTime.parse(iso).toInstant(java.time.ZoneOffset.UTC).toEpochMilli()
          } catch (e3: Exception) {
            return null
          }
        }
      }
    val diff = nowMillis - millis
    val minute = 60_000L
    val hour = 60 * minute
    val day = 24 * hour
    return when {
      diff < minute -> "vừa xong"
      diff < hour -> "${diff / minute} phút"
      diff < day -> "${diff / hour} giờ"
      diff < 2 * day -> "hôm qua"
      else -> "${diff / day} ngày"
    }
  }
}
