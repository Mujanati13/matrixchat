package com.me.matrixchat.Workers

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.me.matrixchat.MyApplication
import com.me.matrixchat.R
import com.me.matrixchat.SessionHolder
import org.matrix.android.sdk.api.session.room.RoomSortOrder
import org.matrix.android.sdk.api.session.room.RoomSummaryQueryParams
import org.matrix.android.sdk.api.session.room.model.Membership

class MessageCheckWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {
    private val NOTIFICATION_CHANNEL_ID = "message_channel"
    private val NOTIFICATION_CHANNEL_NAME = "Messages"
    private val NOTIFICATION_PERMISSION_REQUEST_CODE = 1001

    override suspend fun doWork(): Result {
        // TODO: Replace with how you get your active Matrix session
        val session = SessionHolder.currentSession!!

        // Set up query params
        val queryParams = RoomSummaryQueryParams.Builder().apply {
            memberships = listOf(Membership.JOIN)
        }.build()

        val summaries = session.roomService().getRoomSummaries(queryParams, RoomSortOrder.ACTIVITY)

        summaries.forEach { summary ->
            if (summary.hasUnreadMessages) {
                showNewMessageNotification(applicationContext, summary.displayName, "New message")
            }
        }

        return Result.success()
    }
    fun showNewMessageNotification(context: Context, title: String, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "message_channel",
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            )
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val builder = NotificationCompat.Builder(context, "message_channel")
            .setSmallIcon(R.drawable.circle_unread)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        if (ActivityCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            // TODO: Consider calling
            //    ActivityCompat#requestPermissions
            // here to request the missing permissions, and then overriding
            //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
            //                                          int[] grantResults)
            // to handle the case where the user grants the permission. See the documentation
            // for ActivityCompat#requestPermissions for more details.
            return
        }
        NotificationManagerCompat.from(context).notify(title.hashCode(), builder.build())
    }

}
