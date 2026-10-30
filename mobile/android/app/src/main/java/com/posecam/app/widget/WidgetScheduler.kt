package com.posecam.app.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** WorkManager jobs that refresh the widget: a unique 15-minute periodic job and a one-off job. */
object WidgetScheduler {
  const val PERIODIC_WORK = "posecam-widget-periodic"
  const val ONE_OFF_WORK = "posecam-widget-refresh"

  private val networkConstraint: Constraints =
    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

  fun schedulePeriodic(context: Context) {
    val request =
      PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES)
        .setConstraints(networkConstraint)
        .build()
    WorkManager.getInstance(context.applicationContext)
      .enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
  }

  fun refreshNow(context: Context) {
    val request =
      OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
        .setConstraints(networkConstraint)
        .build()
    WorkManager.getInstance(context.applicationContext)
      .enqueueUniqueWork(ONE_OFF_WORK, ExistingWorkPolicy.REPLACE, request)
  }

  fun cancelAll(context: Context) {
    val wm = WorkManager.getInstance(context.applicationContext)
    wm.cancelUniqueWork(PERIODIC_WORK)
    wm.cancelUniqueWork(ONE_OFF_WORK)
  }
}
