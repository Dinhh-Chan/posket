package com.posecam.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONException
import org.json.JSONObject

/**
 * Fetches `GET /photos/latest` (204 = none) and, when the photo changed,
 * `GET /media/photos/{id}`; caches a downscaled copy and redraws all widgets.
 */
class WidgetRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    val context = applicationContext
    val creds = WidgetStore.credentials(context)
    if (creds == null) {
      PoseCamWidgetProvider.updateAll(context)
      return Result.success()
    }
    return try {
      refresh(context, creds)
      PoseCamWidgetProvider.updateAll(context)
      Result.success()
    } catch (e: IOException) {
      Log.w(TAG, "Widget refresh failed: ${e.message}")
      PoseCamWidgetProvider.updateAll(context)
      if (runAttemptCount < 2) Result.retry() else Result.success()
    } catch (e: JSONException) {
      Log.w(TAG, "Unexpected /photos/latest response: ${e.message}")
      Result.success()
    }
  }

  private fun refresh(context: Context, creds: WidgetStore.Credentials) {
    val latest =
      Request.Builder()
        .url("${creds.serverUrl}/photos/latest")
        .header("Authorization", "Bearer ${creds.token}")
        .header("Accept", "application/json")
        .build()
    client.newCall(latest).execute().use { response ->
      when {
        response.code == 204 -> {
          WidgetStore.clearPhoto(context)
          return
        }
        response.code == 401 -> {
          // Token no longer valid: show the placeholder until the app logs in again.
          WidgetStore.clearPhoto(context)
          return
        }
        !response.isSuccessful -> throw IOException("HTTP ${response.code}")
      }
      val body = response.body?.string() ?: throw IOException("Empty body")
      val json = JSONObject(body)
      val id = json.getLong("id")
      val sender = json.optJSONObject("sender")?.optString("display_name").orEmpty()
      val createdAt = json.optString("created_at").ifEmpty { null }
      if (id != WidgetStore.photoId(context) || !WidgetStore.imageFile(context).exists()) {
        downloadImage(context, creds, id)
      }
      WidgetStore.savePhoto(context, WidgetStore.PhotoInfo(id, sender, createdAt))
    }
  }

  private fun downloadImage(context: Context, creds: WidgetStore.Credentials, id: Long) {
    val request =
      Request.Builder()
        .url("${creds.serverUrl}/media/photos/$id")
        .header("Authorization", "Bearer ${creds.token}")
        .build()
    val bytes =
      client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
        response.body?.bytes() ?: throw IOException("Empty image")
      }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
    val bitmap =
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
        ?: throw IOException("Cannot decode image")
    val side = minOf(bitmap.width, bitmap.height)
    val square =
      Bitmap.createBitmap(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side)
    val target = File(context.filesDir, "widget_photo.tmp")
    FileOutputStream(target).use { out -> square.compress(Bitmap.CompressFormat.JPEG, 90, out) }
    if (!target.renameTo(WidgetStore.imageFile(context))) {
      target.copyTo(WidgetStore.imageFile(context), overwrite = true)
      target.delete()
    }
  }

  companion object {
    private const val TAG = "PoseCamWidget"
    private const val MAX_SIDE = 600

    private val client: OkHttpClient by lazy {
      OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()
    }
  }
}
