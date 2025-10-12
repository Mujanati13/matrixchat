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

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.bumptech.glide.Glide
import com.bumptech.glide.load.model.GlideUrl
import com.bumptech.glide.load.model.LazyHeaders
import com.me.matrixchat.Models.Message
import com.me.matrixchat.ProfileActivity
import com.me.matrixchat.R
import com.stfalcon.chatkit.commons.ImageLoader
import com.stfalcon.chatkit.commons.models.IMessage
import com.stfalcon.chatkit.messages.MessageInput
import kotlinx.coroutines.launch
import org.matrix.android.sdk.api.extensions.orTrue
import org.matrix.android.sdk.api.session.getRoom
import org.matrix.android.sdk.api.session.room.Room
import org.matrix.android.sdk.api.session.room.read.ReadService
import org.matrix.android.sdk.api.session.room.timeline.*
import org.matrix.android.sdk.api.util.toMatrixItem
import com.me.matrixchat.SessionHolder
import com.me.matrixchat.data.TimelineEventMessageWrapper
import com.me.matrixchat.databinding.FragmentRoomDetailBinding
import com.me.matrixchat.utils.*
import com.stfalcon.chatkit.messages.MessagesListAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.matrix.android.sdk.api.session.Session
import org.matrix.android.sdk.api.session.content.ContentAttachmentData
import org.matrix.android.sdk.api.session.content.ContentUrlResolver
import org.matrix.android.sdk.api.session.crypto.attachments.ElementToDecrypt
import org.matrix.android.sdk.api.session.crypto.model.EncryptedFileInfo
import org.matrix.android.sdk.api.session.events.model.EventType
import org.matrix.android.sdk.api.session.events.model.toContent
import org.matrix.android.sdk.api.session.events.model.toModel
import org.matrix.android.sdk.api.session.room.model.message.MessageContent
import org.matrix.android.sdk.api.session.room.model.message.MessageType
import java.io.IOException
import java.net.UnknownHostException
import java.util.Date
import kotlin.coroutines.cancellation.CancellationException
import org.matrix.android.sdk.api.session.room.model.message.MessageImageContent
import org.matrix.android.sdk.api.session.room.model.message.MessageWithAttachmentContent
import java.io.File
import java.io.FileOutputStream
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class RoomDetailFragment : Fragment(), Timeline.Listener, ToolbarConfigurable {

    companion object {

        private const val ROOM_ID_ARGS = "ROOM_ID_ARGS"

        fun newInstance(roomId: String): RoomDetailFragment {

            val args = bundleOf(
                Pair(ROOM_ID_ARGS, roomId)
            )
            return RoomDetailFragment().apply {
                arguments = args
            }
        }
    }

    private var _views: FragmentRoomDetailBinding? = null
    private val views get() = _views!!

    private val session = SessionHolder.currentSession!!
    private var timeline: Timeline? = null
    private var room: Room? = null

    private val avatarRenderer by lazy {
        AvatarRenderer(MatrixItemColorProvider(requireContext()))
    }

    private val pickFileLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            uri?.let {
                handleFileUri(it)
            }
        }


    private val adapter = MessagesListAdapter<IMessage>(session.myUserId, object : ImageLoader {
        override fun loadImage(imageView: ImageView, resolvedUrl: String?, payload: Any?) {
            //loadAvatar(session,imageView, resolvedUrl, session.myUserId)
            if (!resolvedUrl.isNullOrEmpty() && File(resolvedUrl).exists()) {
                Glide.with(imageView.context)
                    .load(File(resolvedUrl)) // Pass as a File, not a String path
                    .placeholder(R.drawable.user_default)
                    .error(R.drawable.backgroundless)
                    .into(imageView)
            } else {

                val accessToken = session.sessionParams?.credentials?.accessToken ?: ""
                // Build GlideUrl with the Authorization header
                val glideUrl = GlideUrl(
                    resolvedUrl,
                    LazyHeaders.Builder()
                        .addHeader("Authorization", "Bearer $accessToken")
                        .build()
                )
                Glide.with(this@RoomDetailFragment)
                    .load(glideUrl)  // Use GlideUrl directly to preserve authentication headers
                    .into(imageView)
            }
        }

    })
    //private val timelineEventListProcessor = TimelineEventListProcessor(adapter)

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _views = FragmentRoomDetailBinding.inflate(inflater, container, false)
        return views.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        configureToolbar(views.toolbar, displayBack = true)
        val roomId = arguments?.getString(ROOM_ID_ARGS)!!
        // You can grab a room from the session
        // If the room is not known (not received from sync) it will return null
        room = session.getRoom(roomId)
        Log.e("RoomId", "" + roomId)
        val membership = room?.roomSummary()?.membership
        Log.d("Matrix", "Membership status: $membership")

        if (("$membership") != "JOIN") {
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    session.roomService().joinRoom(roomId)
                    Log.d("Matrix", "Joined the room")
                } catch (e: Exception) {
                    Log.e("Matrix", "Join failed: ${e.message}")
                }
            }
        }

        views.textComposer.setOnclickListenerForAttachmentButton {
            sendAttachment()
        }


        views.textComposer.setInputListener {
            // Sending message can be as simple as that.
            // Timeline will be automatically updated with local echo
            // and when receiving from sync so you don't have anything else to do
            room?.sendService()?.sendTextMessage(it)
            Log.e("Message", it.toString())
            true
        }

        views.textComposer.setTypingListener(object : MessageInput.TypingListener {
            override fun onStartTyping() {
                room?.typingService()?.userIsTyping()
            }

            override fun onStopTyping() {
                room?.typingService()?.userStopsTyping()
            }
        })

        views.timelineEventList.setAdapter(adapter)
        views.timelineEventList.itemAnimator = null
        views.timelineEventList.addOnScrollListener(RecyclerScrollMoreListener(views.timelineEventList.layoutManager as LinearLayoutManager) {
            if (timeline?.hasMoreToLoad(Timeline.Direction.BACKWARDS).orTrue()) {
                timeline?.paginate(Timeline.Direction.BACKWARDS, 50)
            }
        })

        lifecycleScope.launch {
            room?.readService()?.markAsRead(ReadService.MarkAsReadParams.READ_RECEIPT)
        }

        // Create some settings to configure timeline
        val timelineSettings = TimelineSettings(
            initialSize = 30
        )
        // Then you can retrieve a timeline from this room.
        timeline = room?.timelineService()?.createTimeline(null, timelineSettings)?.also {
            // Don't forget to add listener and start the timeline so it start listening to changes
            //Log.e("Timeline", ""+roomId)
            it.addListener(this)
            it.start()
        }

        // You can also listen to room summary from the room
        room?.getRoomSummaryLive()?.observe(viewLifecycleOwner) { roomSummary ->
            val roomSummaryAsMatrixItem =
                roomSummary.map { it.toMatrixItem() }.getOrNull() ?: return@observe
            //avatarRenderer.render(roomSummaryAsMatrixItem, views.toolbarAvatarImageView)
            views.imgCont.setOnClickListener {
                val intent = Intent(context, ProfileActivity::class.java)
                intent.putExtra("userId", roomSummaryAsMatrixItem.id)
                intent.putExtra("displayName", roomSummaryAsMatrixItem.displayName)
                intent.putExtra("avartarUrl", roomSummaryAsMatrixItem.avatarUrl)
                startActivity(intent)
            }
            views.toolbarTitleView.setOnClickListener {
                views.imgCont.performClick()
            }
            views.toolbarTitleView.setOnClickListener {
                views.imgCont.performClick()
            }

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    // Fetch Avatar URL
                    val avatarUrl = roomSummaryAsMatrixItem.avatarUrl

                    // Load or Observe Avatar
                    if (avatarUrl != null) {
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
                            runCatching {
                                loadAvatar(
                                    session,
                                    views.toolbarAvatarImageView,
                                    avatarUrl
                                )
                            }
                                .onFailure { e ->
                                    Log.e(
                                        "RecoveryActivity",
                                        "Error loading avatar",
                                        e
                                    )
                                }
                        }
                    }
                } catch (e: CancellationException) {
                    Log.e("CoroutineCancelled", "Coroutine was cancelled", e)
                    throw e // Rethrow to maintain structured concurrency
                } catch (e: Exception) {
                    Log.e("RecoveryActivity", "Unexpected error in coroutine", e)
                }
            }

            views.toolbarTitleView.text = roomSummaryAsMatrixItem.let {
                it.displayName?.takeIf { dn -> dn.isNotBlank() } ?: it.id
            }.toSentenceCase()
        }


    }

    override fun onDestroyView() {
        timeline?.also {
            // Don't forget to remove listener and dispose timeline to avoid memory leaks
            it.removeAllListeners()
            it.dispose()
        }
        timeline = null
        room = null
        super.onDestroyView()
    }

    override fun onNewTimelineEvents(eventIds: List<String>) {
        // This is new event ids coming from sync
    }

    override fun onTimelineFailure(throwable: Throwable) {
        // When a failure is happening when trying to retrieve an event.
        // This is an unrecoverable error, you might want to restart the timeline
        // timeline?.restartWithEventId("")
    }

    override fun onTimelineUpdated(snapshot: List<TimelineEvent>) {
        // Each time the timeline is updated it will be called.
        // It can happens when sync returns, paginating, and updating (local echo, decryption finished...)
        // You probably want to process with DiffUtil before dispatching to your recyclerview
        //var filteredSnapshot = snapshot.filter { it.root.type == "m.room.message"}
        lifecycleScope.launch {
            val chatMessages = snapshot
                .filter { it.root.type == EventType.ENCRYPTED || it.root.type == EventType.MESSAGE }
                .mapNotNull { event ->
                    try {
                        val contentJson = event.root.getClearContent()
                        val content =
                            contentJson.toModel<MessageContent>() ?: return@mapNotNull null

                        val senderId = event.root.senderId
                        val eventId = event.eventId
                        val timestamp =
                            event.root.originServerTs?.toString() ?: System.currentTimeMillis()
                                .toString()

                        when (content.msgType) {
                            MessageType.MSGTYPE_TEXT -> {
                                Message(
                                    event,
                                    eventId,
                                    senderId,
                                    room?.roomId,
                                    content.body,
                                    null,
                                    timestamp,
                                    false
                                )
                            }


                            MessageType.MSGTYPE_IMAGE ->  {
                                try {
                                    val contentJson = event.root.getClearContent() as? Map<*, *>
                                    val message = if (contentJson?.containsKey("url") == true) {
                                        //decrypted
                                        val mxc = contentJson["url"] as? String
                                        val publicUrl = session.contentUrlResolver()
                                            .resolveFullSize(mxc)
                                            ?.let { u -> "$u?access_token=${session.sessionParams.credentials.accessToken}" }
                                        Message(
                                            event,
                                            eventId,
                                            senderId,
                                            room?.roomId,
                                            null,
                                            publicUrl,
                                            timestamp,
                                            false
                                        )
                                    } else {
                                        //encrypted
                                        val fileMap = contentJson?.get("file") as? Map<*, *>
                                        val mxcUri = fileMap?.get("url") as? String
                                        val ivB64 = fileMap?.get("iv") as? String
                                        val keyMap = fileMap?.get("key") as? Map<*, *>
                                        val keyB64 = keyMap?.get("k") as? String

                                        val baseUrl = session.contentUrlResolver()
                                            .resolveFullSize(mxcUri)!!
                                            ?.replace("/_matrix/media/r0/", "/_matrix/client/v1/media/")

                                        val authUrl =
                                            "$baseUrl?access_token=${session.sessionParams.credentials.accessToken}"

                                        val localFile = withContext(Dispatchers.IO) {
                                            fetchAndDecrypt(contentJson.toContent().toModel<MessageImageContent>()?.body, authUrl, keyB64, ivB64)
                                        }
                                        Message(
                                            event,
                                            eventId,
                                            senderId,
                                            room?.roomId,
                                            null,
                                            localFile.absolutePath,
                                            timestamp,
                                            false
                                        )
                                    }
                                    message // returned value
                                } catch (t: Throwable) {
                                    Log.e("Matrix", "img load failed", t)
                                    null
                                }
                            }


                            else -> null // Skip other types
                        }

                    } catch (e: Exception) {
                        Log.e("TimelineDecrypt", "Error processing message", e)
                        null
                    }
                }.reversed()


            adapter.clear()
            adapter.addToEnd(chatMessages, true)

            //timelineEventListProcessor.onNewSnapshot(snapshot, viewLifecycleOwner)
        }
    }

    private suspend fun fetchAndDecrypt(name: String?, url: String, keyB64: String?, ivB64: String?): File {
        withContext(Dispatchers.Main) {
            views.progressBar3.visibility = View.VISIBLE
        }
        // 3a. Prepare cipher
        val keyBytes = Base64.decode(keyB64, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        val key = SecretKeySpec(keyBytes, "AES")
        val iv = IvParameterSpec(Base64.decode(ivB64, Base64.DEFAULT))
        val cipher = Cipher.getInstance("AES/CTR/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key, iv)
        }

        // 3b. Download over OkHttp
        val client = OkHttpClient()
        val resp = client.newCall(Request.Builder().url(url).build()).execute()
        val cis = CipherInputStream(resp.body!!.byteStream(), cipher)

        // 3c. Write out decrypted bytes
        val outFile = File(context?.cacheDir, name)
        FileOutputStream(outFile).use { fos ->
            cis.copyTo(fos)
        }
        withContext(Dispatchers.Main) {
            views.progressBar3.visibility = View.GONE
        }
        return outFile
    }


    private fun getDefaultImageFile(): File {
        val drawable = ContextCompat.getDrawable(
            requireContext(),
            R.drawable.user_default
        )
        val bitmap = (drawable as BitmapDrawable).bitmap
        val file =
            File(context?.cacheDir, "default_image.jpg")
        val out = FileOutputStream(file)
        bitmap.compress(
            Bitmap.CompressFormat.JPEG,
            100,
            out
        )
        out.flush()
        out.close()
        return file
    }

    private fun loadAvatar(
        session: Session,
        imageView: ImageView,
        avatarUrl: String?,
        user: String? = null
    ) {
        try {

            if (!avatarUrl.isNullOrEmpty() && (avatarUrl.startsWith("mxc://"))) {
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
                        .circleCrop()
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
    private fun observeUserAvatar(session: Session, imageView: ImageView, user: String? = null) {
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

    private fun String.toSentenceCase(): String {
        return this.lowercase()
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }

    private fun sendAttachment() {
        pickFileLauncher.launch("image/*")
    }

    private fun handleFileUri(uri: Uri) {
        val fileName = getFileNameFromUri(uri) ?: "attachment"
        val mimeType = requireContext().contentResolver.getType(uri) ?: "application/octet-stream"
        val size = getFileSize(uri)

        val contentAttachmentData = ContentAttachmentData(
            name = fileName,
            queryUri = uri,
            mimeType = mimeType,
            type = ContentAttachmentData.Type.IMAGE
        )

        lifecycleScope.launch {
            try {
                room?.sendService()?.sendMedia(
                    contentAttachmentData,
                    false,
                    roomIds = setOf(room?.roomId) as Set<String>
                )
                Log.d("Matrix", "File sent successfully")
            } catch (e: Exception) {
                Log.e("Matrix", "Failed to send file: ${e.message}")
            }
        }
    }

    private fun getFileNameFromUri(uri: Uri): String? {
        var result: String? = null
        if (uri.scheme == "content") {
            val cursor = requireContext().contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    result = it.getString(it.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))
                }
            }
        }
        if (result == null) {
            result = uri.path
            val cut = result?.lastIndexOf('/') ?: -1
            if (cut != -1) {
                result = result?.substring(cut + 1)
            }
        }
        return result
    }

    private fun getFileSize(uri: Uri): Long {
        var size: Long = 0
        if (uri.scheme == "content") {
            val cursor = requireContext().contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    size = it.getLong(it.getColumnIndexOrThrow(OpenableColumns.SIZE))
                }
            }
        }
        return size
    }


    private fun getFileName(uri: Uri): String? {
        var name: String? = null
        val cursor = requireContext().contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                name = it.getString(it.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))
            }
        }
        return name
    }
}
