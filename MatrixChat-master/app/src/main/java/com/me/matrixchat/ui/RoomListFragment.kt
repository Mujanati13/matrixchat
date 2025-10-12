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

package com.me.matrixchat.ui

//import com.android.volley.toolbox.ImageLoader
import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.res.Resources
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.bumptech.glide.load.model.GlideUrl
import com.bumptech.glide.load.model.LazyHeaders
import com.me.matrixchat.AboutActivity
import com.me.matrixchat.Login
import com.me.matrixchat.PasswordActivity
import com.me.matrixchat.R
import com.me.matrixchat.SessionHolder
import com.me.matrixchat.data.RoomSummaryDialogWrapper
import com.me.matrixchat.databinding.FragmentRoomListBinding
import com.me.matrixchat.formatter.RoomListDateFormatter
import com.me.matrixchat.utils.AvatarRenderer
import com.me.matrixchat.utils.MatrixItemColorProvider
import com.stfalcon.chatkit.commons.ImageLoader
import com.me.matrixchat.Adapters.DialogListAdapter
import com.me.matrixchat.ProfileActivity
import com.me.matrixchat.SearchActivity
//import com.stfalcon.chatkit.dialogs.DialogsListAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.matrix.android.sdk.api.session.Session
import org.matrix.android.sdk.api.session.content.ContentUrlResolver
import org.matrix.android.sdk.api.session.room.RoomSortOrder
import org.matrix.android.sdk.api.session.room.RoomSummaryQueryParams
import org.matrix.android.sdk.api.session.room.model.Membership
import org.matrix.android.sdk.api.session.room.model.RoomSummary
import org.matrix.android.sdk.api.session.room.roomSummaryQueryParams
import org.matrix.android.sdk.api.util.toMatrixItem
import java.io.IOException
import java.net.UnknownHostException
import kotlin.coroutines.cancellation.CancellationException

class RoomListFragment : Fragment(), ToolbarConfigurable {

    private val session = SessionHolder.currentSession!!
    private val NOTIFICATION_CHANNEL_ID = "message_channel"
    private val NOTIFICATION_CHANNEL_NAME = "Messages"
    private val NOTIFICATION_PERMISSION_REQUEST_CODE = 1001
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _views = FragmentRoomListBinding.inflate(inflater, container, false)
        return views.root
    }

    private var _views: FragmentRoomListBinding? = null
    private val views get() = _views!!

    private val avatarRenderer by lazy {
        AvatarRenderer(MatrixItemColorProvider(requireContext()))
    }

    private val imageLoader = ImageLoader { imageView, url, user ->
        //avatarRenderer.render(url, imageView)
        var userStr = user ?: ""
        loadAvatar(session, imageView, url, userStr as String)
    }
    private val roomAdapter = DialogListAdapter<RoomSummaryDialogWrapper>(imageLoader)
    private lateinit var moreOptions: ImageView


    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        //configureToolbar(views.toolbar, displayBack = false)
        views.roomSummaryList.setAdapter(roomAdapter)
        moreOptions = views.moreOptions

        moreOptions.setOnClickListener { view ->
            showPopup(view)
        }
        roomAdapter.setDatesFormatter(RoomListDateFormatter())
        roomAdapter.setOnDialogClickListener {
            showRoomDetail(it.roomSummary)
        }
        roomAdapter.setOnDialogLongClickListener {
            showRoomOption(it.roomSummary)
        }

        views.newRoom.setOnClickListener {
            createRoom()
        }
        views.search.setOnClickListener {
            startActivity(Intent(context, SearchActivity::class.java))

        }
        views.imgCont.setOnClickListener {
            startActivity(Intent(context, ProfileActivity::class.java))
        }
        views.name.setOnClickListener {
            views.imgCont.performClick()
        }
        views.toolbarTitleView.setOnClickListener {
            views.imgCont.performClick()
        }
        // Create query to listen to room summary list
        val roomSummariesQuery = roomSummaryQueryParams {
            memberships = Membership.activeMemberships()
        }
        // Then you can subscribe to livedata..
        session.roomService().getRoomSummariesLive(roomSummariesQuery).observe(viewLifecycleOwner) {
            // ... And refresh your adapter with the list. It will be automatically updated when an item of the list is changed.
            autoJoinInvitedRooms(session, it)
            updateRoomList(it)
        }

        //handle notification badge
        val queryParams = RoomSummaryQueryParams.Builder()
            .apply {
                memberships = listOf(Membership.JOIN)
            }
            .build()
        val sortOrder = RoomSortOrder.ACTIVITY
        session.roomService().getRoomSummariesLive(queryParams, sortOrder)
            .observe(viewLifecycleOwner) { roomSummaries ->
                roomSummaries.forEach { summary ->
                    if (summary.hasUnreadMessages) {
                        showNewMessageNotification(
                            requireActivity(),
                            summary.displayName,
                            summary.topic
                        )
                    }
                }
            }


        // You can also listen to user. Here we listen to ourself to get our avatar
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                // Fetch Display Name
                val displayName = withContext(Dispatchers.IO) {
                    runCatching {
                        session.profileService().getDisplayName(session.myUserId)
                            .orElse { "" }
                            .toSentenceCase()
                    }.getOrElse { e ->
                        when (e) {
                            is UnknownHostException -> {
                                Log.e("NetworkError", "No Internet Connection: ${e.message}")
                                "No Internet"
                            }

                            is IOException -> {
                                Log.e("NetworkError", "Network error occurred: ${e.message}")
                                "Network Error"
                            }

                            else -> {
                                Log.e("RecoveryActivity", "Error retrieving name", e)
                                Toast.makeText(
                                    context,
                                    "Unable to retrive info, Please check your internet connection",
                                    Toast.LENGTH_SHORT
                                )
                                "__"
                            }
                        }
                    }
                }
                views.name.text = displayName

                // Fetch Avatar URL
                val avatarUrl = withContext(Dispatchers.IO) {
                    runCatching {
                        session.profileService().getAvatarUrl(session.myUserId).orElse { "" }
                    }.getOrElse { e ->
                        when (e) {
                            is UnknownHostException -> Log.e(
                                "NetworkError",
                                "No Internet Connection: ${e.message}"
                            )

                            is IOException -> Log.e("NetworkError", "Network error: ${e.message}")
                            else -> Log.e("RecoveryActivity", "Error retrieving avatar URL", e)
                        }
                        "" // Fallback to empty
                    }
                }

                // Load or Observe Avatar
                if (avatarUrl.isBlank()) {
                    runCatching { observeUserAvatar(session, views.toolbarAvatarImageView) }
                        .onFailure { e ->
                            Log.e(
                                "RecoveryActivity",
                                "Error observing user avatar",
                                e
                            )
                        }
                } else {
                    runCatching { loadAvatar(session, views.toolbarAvatarImageView, avatarUrl) }
                        .onFailure { e -> Log.e("RecoveryActivity", "Error loading avatar", e) }
                }

            } catch (e: CancellationException) {
                Log.e("CoroutineCancelled", "Coroutine was cancelled", e)
                throw e // Rethrow to maintain structured concurrency
            } catch (e: Exception) {
                Log.e("RecoveryActivity", "Unexpected error in coroutine", e)
            }
        }

        setHasOptionsMenu(true)

    }

    fun showNewMessageNotification(
        activity: Activity,
        roomName: String,
        messagePreview: String
    ) {
        // Handle notification permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    activity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    NOTIFICATION_PERMISSION_REQUEST_CODE
                )
                return // Don’t proceed without permission
            }
        }

        // Create notification channel (if not created already)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for unread messages"
            }

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }

        // Build and show the notification
        val builder = NotificationCompat.Builder(activity, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.circle_unread) // Replace with your app's icon
            .setContentTitle(roomName)
            .setContentText(messagePreview)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        NotificationManagerCompat.from(activity).notify(
            roomName.hashCode(), // Unique ID per room
            builder.build()
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Optionally show notification again now that permission is granted
            } else {
                Toast.makeText(context, "Notification permission denied", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showRoomOption(roomSummary: RoomSummary) {
        val inflater = LayoutInflater.from(context)
        val popupView = inflater.inflate(R.layout.custom_room_list_menu, null)

        // Create the PopupWindow
        val popupWindow = PopupWindow(
            popupView,
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            true // Dismiss when clicking outside
        ).apply {
            elevation = 10f
        }

        val deleteRoom: TextView = popupView.findViewById(R.id.deleteRoom)
        val cancel: TextView = popupView.findViewById(R.id.cancel)

        // Dim the background
        val parentView = views.roomSummaryList // or your root layout
        //parentView.foreground = ColorDrawable(Color.parseColor("#80000000")) // 50% black

        // Handle Delete Room click
        deleteRoom.setOnClickListener {
            Toast.makeText(context, "Deleting room", Toast.LENGTH_SHORT).show()
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    Log.e("MatrixChat", "Attempting to delete room: ${roomSummary.roomId}")
                    session.roomService().leaveRoom(roomSummary.roomId)
                    Log.e("MatrixChat", "Successfully deleted room: ${roomSummary.roomId}")
                } catch (e: Exception) {
                    Log.e("MatrixChat", "Failed to delete room: ${roomSummary.roomId}", e)
                    Toast.makeText(context, "Failed to delete room", Toast.LENGTH_SHORT).show()
                }
            }
            popupWindow.dismiss()
        }

        // Handle Cancel click
        cancel.setOnClickListener {
            popupWindow.dismiss()
        }

        // When popup dismisses, clear the dim
        popupWindow.setOnDismissListener {
            parentView.foreground = null
        }

        // Show the popup centered
        popupWindow.showAtLocation(parentView, Gravity.CENTER, 0, 0)
    }


    private fun createRoom() {
        val container = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 24, 40, 24) // Apply padding to the whole dialog container
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        // Create input field
        val input = EditText(requireContext()).apply {
            hint = "@user:matrixchat"
            setPadding(36, 24, 36, 24)
            inputType = InputType.TYPE_CLASS_TEXT
            setBackgroundResource(R.drawable.bordered_input_light)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        // Add input to container
        container.addView(input)


        // Show dialog to ask for Room ID
        AlertDialog.Builder(requireContext())
            .setTitle("Create Room")
            .setMessage("Enter Room ID in format @username:matrixchat")
            .setView(container) // Set the padded container
            .setPositiveButton("Create") { _, _ ->
                val roomId = input.text.toString().trim()
                if (roomId.isEmpty()) {
                    Toast.makeText(requireContext(), "Room ID cannot be empty!", Toast.LENGTH_SHORT)
                        .show()
                } else if (!isValidRoomId(roomId)) {
                    Toast.makeText(requireContext(), "Invalid Room ID format!", Toast.LENGTH_SHORT)
                        .show()
                } else {
                    createRoomWithId(roomId)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    fun Int.dpToPx(): Int {
        return (this * Resources.getSystem().displayMetrics.density).toInt()
    }

    // Validate Room ID format (@username:servername)
    private fun isValidRoomId(roomId: String): Boolean {
        val regex = Regex("^@[a-zA-Z0-9_.-]+:[a-zA-Z0-9.-]+$")
        return roomId.matches(regex)
    }

    // Method to create room using the provided ID
    private fun createRoomWithId(roomId: String) {
        views.progressBar2.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val roomService = session.roomService()
                val nRoom = roomService.createDirectRoom(roomId)
                val roomDetailFragment = RoomDetailFragment.newInstance(nRoom)
                (activity as MainActivity).supportFragmentManager
                    .beginTransaction()
                    .addToBackStack(null)
                    .replace(R.id.fragmentContainer, roomDetailFragment)
                    .commit()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(
                    requireContext(),
                    "Failed to create room: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                views.progressBar2.visibility = View.GONE
            }
        }
    }


    override fun onCreateOptionsMenu(menu: Menu, inflater: MenuInflater) {
        inflater.inflate(R.menu.main, menu)
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.logout -> {
                signOut()
                true
            }

            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun signOut() {
        views.progressBar2.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                session.signOutService().signOut(true)
            } catch (failure: Throwable) {
                activity?.let {

                    Toast.makeText(
                        it,
                        "Sign-out failed due to no network connection.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                return@launch
            } finally {
                views.progressBar2.visibility = View.GONE
            }

            SessionHolder.currentSession = null
            startActivity(Intent(context, Login::class.java))
            val prefs: SharedPreferences? =
                context?.getSharedPreferences(PasswordActivity.PREFS_NAME, Context.MODE_PRIVATE)
            prefs?.edit()?.clear()?.apply()
            activity?.finish()
        }
    }

    private fun showRoomDetail(roomSummary: RoomSummary) {
        val roomDetailFragment = RoomDetailFragment.newInstance(roomSummary.roomId)
        (activity as MainActivity).supportFragmentManager
            .beginTransaction()
            .addToBackStack(null)
            .replace(R.id.fragmentContainer, roomDetailFragment)
            .commit()
    }

    private fun autoJoinInvitedRooms(session: Session, roomSummaries: List<RoomSummary>) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                roomSummaries.filter { it.membership == Membership.INVITE }.forEach { summary ->
                    session.roomService().joinRoom(summary.roomId)
                }
            } catch (e: CancellationException) {
                Log.e("CoroutineCancelled", "Coroutine was cancelled", e)
                throw e // Rethrow to maintain structured concurrency
            } catch (e: Exception) {
                Log.e("RecoveryActivity", "Unexpected error in coroutine", e)
            }
        }
    }

    private fun olDupdateRoomList(roomSummaryList: List<RoomSummary>?) {
        if (roomSummaryList == null) return
        val sortedRoomSummaryList = roomSummaryList.sortedByDescending {
            it.latestPreviewableEvent?.root?.originServerTs
        }.map {
            RoomSummaryDialogWrapper(it)
        }
        try {
            roomAdapter.setItems(sortedRoomSummaryList)
        } catch (e: Exception) {
            Log.e("RecoveryActivity", "Error setting items to adapter", e)
        }
    }

    private fun updateRoomList(roomSummaryList: List<RoomSummary>?) {
        if (roomSummaryList == null) return

        // Filter to include both JOINED and INVITED rooms with at least one previewable event
        val filteredRooms = roomSummaryList.filter { roomSummary ->
            (roomSummary.membership == Membership.JOIN || roomSummary.membership == Membership.INVITE) &&
                    roomSummary.latestPreviewableEvent != null
        }

        // Remove duplicates just in case
        val uniqueRooms = filteredRooms.distinctBy { it.roomId }

        // Sort rooms by timestamp, newest first
        val sortedRoomSummaryList = uniqueRooms.sortedByDescending {
            it.latestPreviewableEvent?.root?.originServerTs ?: 0L
        }.map {
            RoomSummaryDialogWrapper(it)
        }

        // Update the adapter
        try {
            roomAdapter.setItems(sortedRoomSummaryList)
        } catch (e: Exception) {
            Log.e("RecoveryActivity", "Error setting items to adapter", e)
        }
    }


    private fun loadAvatar(
        session: Session,
        imageView: ImageView,
        avatarUrl: String?,
        user: String? = null
    ) {
        try {

            if (!avatarUrl.isNullOrEmpty() && avatarUrl.startsWith("mxc://")) {
                // Resolve the MXC URI to a thumbnail URL using the v1 endpoint.
                // Note: Many SDKs let you pass an argument (or use a different resolver) to generate a v1 URL.
                val resolvedUrl = session.contentUrlResolver().resolveThumbnail(
                    avatarUrl,
                    100,
                    100,
                    ContentUrlResolver.ThumbnailMethod.SCALE
                )?.replace("/_matrix/media/r0/", "/_matrix/client/v1/media/")

                if (resolvedUrl != null) {
                    // Retrieve the access token – or hardcode it if necessary.
                    // For example, using a hardcoded token:
                    // val accessToken = "syt_dGVzdHVzZXIyMg_siKxJKwLMAlCATmYUmHB_2xRTgP"
                    val accessToken = session.sessionParams?.credentials?.accessToken ?: ""

                    // Build GlideUrl with the Authorization header
                    val glideUrl = GlideUrl(
                        resolvedUrl,
                        LazyHeaders.Builder()
                            .addHeader("Authorization", "Bearer $accessToken")
                            .build()
                    )
                    Glide.with(imageView.context)
                        .load(glideUrl)
                        .placeholder(R.drawable.user_default) // Placeholder image resource
                        .error(R.drawable.user_default)       // Error image resource
                        //.circleCrop()
                        .into(imageView)
                } else {
                    // Fallback if resolution fails
                    observeUserAvatar(session, imageView, user)
                }
            } else {
                // Fallback to observe user avatar if there's no valid MXC URI
                observeUserAvatar(session, imageView, user)
            }
        } catch (e: IOException) {
            Log.e("NetworkError", "No Internet Connection: ${e.message}")

        } catch (e: UnknownHostException) {
            Log.e("NetworkError", "No Internet Connection: ${e.message}")
            "" // Return empty to trigger fallback
        } catch (e: Exception) {
            Log.e("APIError", "Something went wrong: ${e.message}")
        }
    }


    // Fallback: Listen to user profile updates
    private fun observeUserAvatar(
        session: Session,
        imageView: ImageView,
        user: String? = null
    ) {
        if (user != null) {
            avatarRenderer.render(user, imageView)
        } else {
            session.userService().getUserLive(session.myUserId)
                .observe(viewLifecycleOwner) { user ->
                    val userMatrixItem =
                        user.map { it.toMatrixItem() }.getOrNull() ?: return@observe
                    avatarRenderer.render(userMatrixItem, imageView)
                }
        }
    }


    private fun showPopup(anchorView: View) {
        // Inflate the custom menu layout
        val inflater = LayoutInflater.from(context)
        val popupView = inflater.inflate(R.layout.custom_options_menu, null)


        val aboutL = popupView.findViewById<LinearLayout>(R.id.aboutLayout)

        aboutL.setOnClickListener {
            startActivity(Intent(context, AboutActivity::class.java))
        }

        // Create the PopupWindow
        val popupWindow = PopupWindow(
            popupView,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            true // Click outside to dismiss
        )

        // Find the logout option inside popup
        val logoutLayout: LinearLayout = popupView.findViewById(R.id.logoutLayout)
        val logoutText: TextView = popupView.findViewById(R.id.logoutText)

        // Handle logout click
        logoutLayout.setOnClickListener {
            Toast.makeText(context, "Logging out", Toast.LENGTH_SHORT).show()
            signOut()
            popupWindow.dismiss()
            // Add your logout logic here
        }

        // Show popup at the right position
        popupWindow.elevation = 10f
        popupWindow.showAsDropDown(anchorView, -20, 10)
    }

    private fun String.toSentenceCase(): String {
        return this.lowercase()
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }

}
