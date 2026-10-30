package com.posecam.app.widget

import android.content.Context
import android.content.SharedPreferences
import java.io.File

/**
 * Persistent state shared by the JS bridge, the refresh worker and the widget provider:
 * server URL + token (written by the app on login/launch) and the newest friend photo.
 */
object WidgetStore {
  private const val PREFS = "posecam_widget"
  private const val KEY_SERVER = "server_url"
  private const val KEY_TOKEN = "token"
  private const val KEY_PHOTO_ID = "photo_id"
  private const val KEY_SENDER = "sender_name"
  private const val KEY_CREATED_AT = "created_at"
  private const val IMAGE_FILE = "widget_photo.jpg"

  data class Credentials(val serverUrl: String, val token: String)

  data class PhotoInfo(val id: Long, val senderName: String, val createdAt: String?)

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveCredentials(context: Context, serverUrl: String, token: String) {
    prefs(context).edit()
      .putString(KEY_SERVER, serverUrl.trimEnd('/'))
      .putString(KEY_TOKEN, token)
      .apply()
  }

  fun credentials(context: Context): Credentials? {
    val p = prefs(context)
    val server = p.getString(KEY_SERVER, null)
    val token = p.getString(KEY_TOKEN, null)
    if (server.isNullOrBlank() || token.isNullOrBlank()) return null
    return Credentials(server, token)
  }

  fun photo(context: Context): PhotoInfo? {
    val p = prefs(context)
    val id = p.getLong(KEY_PHOTO_ID, -1L)
    if (id < 0 || !imageFile(context).exists()) return null
    return PhotoInfo(id, p.getString(KEY_SENDER, "") ?: "", p.getString(KEY_CREATED_AT, null))
  }

  fun photoId(context: Context): Long = prefs(context).getLong(KEY_PHOTO_ID, -1L)

  fun savePhoto(context: Context, info: PhotoInfo) {
    prefs(context).edit()
      .putLong(KEY_PHOTO_ID, info.id)
      .putString(KEY_SENDER, info.senderName)
      .putString(KEY_CREATED_AT, info.createdAt)
      .apply()
  }

  fun clearPhoto(context: Context) {
    prefs(context).edit()
      .remove(KEY_PHOTO_ID)
      .remove(KEY_SENDER)
      .remove(KEY_CREATED_AT)
      .apply()
    imageFile(context).delete()
  }

  fun clearAll(context: Context) {
    prefs(context).edit().clear().apply()
    imageFile(context).delete()
  }

  fun imageFile(context: Context): File = File(context.applicationContext.filesDir, IMAGE_FILE)
}
