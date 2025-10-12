package com.me.matrixchat

/*
 * Copyright (c) 2020 New Vector Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.me.matrixchat.Workers.MessageCheckWorker
import org.matrix.android.sdk.api.Matrix
import org.matrix.android.sdk.api.MatrixConfiguration
import java.util.concurrent.TimeUnit


class MyApplication : Application() {

    private lateinit var matrix: Matrix

    override fun onCreate() {
        super.onCreate()

        // You should first create a Matrix instance before using it
        createMatrix()
        // You can then grab the authentication service and search for a known session
        val lastSession = matrix.authenticationService().getLastAuthenticatedSession()
        if (lastSession != null) {
            SessionHolder.currentSession = lastSession
            // Don't forget to open the session and start syncing.

            lastSession.open()
            lastSession.syncService().startSync(true)
        }
        createNotificationChannel(this);
    }

    private fun createMatrix() {
        matrix = Matrix(
            context = this,
            matrixConfiguration = MatrixConfiguration(
                roomDisplayNameFallbackProvider = RoomDisplayNameFallbackProviderImpl()
            )
        )
    }

    companion object {
        fun getMatrix(context: Context): Matrix {
            return (context.applicationContext as MyApplication).matrix
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "message_channel",
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Matrix message notifications"
                setShowBadge(true) // Enable badge!
            }

            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
        val workRequest = PeriodicWorkRequestBuilder<MessageCheckWorker>(
            15, TimeUnit.MINUTES // Minimum interval allowed
        ).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "message_checker",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )

    }

}