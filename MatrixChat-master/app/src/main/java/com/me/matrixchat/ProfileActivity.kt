package com.me.matrixchat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import androidx.lifecycle.Observer
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.bumptech.glide.load.model.GlideUrl
import com.bumptech.glide.load.model.LazyHeaders
import com.google.gson.annotations.SerializedName
import com.me.matrixchat.utils.AvatarRenderer
import com.me.matrixchat.utils.MatrixItemColorProvider
import com.squareup.picasso.Picasso
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.matrix.android.sdk.api.auth.AuthenticationService
import org.matrix.android.sdk.api.session.Session
import org.matrix.android.sdk.api.session.content.ContentUrlResolver
import org.matrix.android.sdk.api.util.toMatrixItem
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import java.io.IOException
import java.net.UnknownHostException

// Make sure to import your Matrix SDK types such as Session, ContentUrlResolver, etc.
class ProfileActivity : AppCompatActivity() {

    companion object {
        private const val REQUEST_CODE_SELECT_AVATAR = 1001
    }

    private var avatarUri: Uri? = null
    private val pickImageLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri != null) {
                avatarUri = uri
                val imageView = findViewById<ImageView>(R.id.toolbarAvatarImageView)

                // Ensure Picasso cancels any pending request
                Picasso.get().cancelRequest(imageView)
                // Ensure previous image is cleared
                imageView.setImageBitmap(null)
                imageView.setImageDrawable(null)
                imageView.setImageResource(android.R.color.transparent)

                // Set the new selected image
                imageView.setImageURI(uri)

                findViewById<Button>(R.id.updateButton).text = "Update Avatar"
            } else {
                Log.e("MatrixChat", "No image selected")
            }
        }
    private lateinit var homeserver: String

    private lateinit var session: Session
    private val avatarRenderer by lazy {
        AvatarRenderer(MatrixItemColorProvider(this))
    }
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)

        // Initialize session from your SessionHolder
        session = SessionHolder.currentSession!!
        homeserver = getString(R.string.homeserver_url)

        // Find views from the layout
        val matrixIdText = findViewById<TextView>(R.id.matrixIdText)
        val nameTextView = findViewById<TextView>(R.id.usernameText)
        val aboutTextView = findViewById<TextView>(R.id.about)
        val avatarImageView = findViewById<ImageView>(R.id.toolbarAvatarImageView)
        val logoutButton = findViewById<Button>(R.id.logoutButton)
        progressBar = findViewById<ProgressBar>(R.id.progressBar2)
        val back = findViewById<Button>(R.id.back)
        val forgotPass = findViewById<TextView>(R.id.forgotPass)
        val updateBtn = findViewById<Button>(R.id.updateButton)

        val copyId = findViewById<ImageView>(R.id.copyId)
        val copyName = findViewById<ImageView>(R.id.copyName)
        val copyAbout = findViewById<ImageView>(R.id.copyAbout)

        // Check if profile info is passed via intent extras (for displaying other user's profile)
        val intentDisplayName = intent.getStringExtra("displayName")
        val intentUserId = intent.getStringExtra("userId")
        val intentAvartarUrl = intent.getStringExtra("avartarUrl")
        val intentAbout = intent.getStringExtra("about")

        if (intentDisplayName != null || intentUserId != null || intentAvartarUrl != null) {
            // Use the passed info to display the profile
            matrixIdText.text = intentUserId
            nameTextView.text = intentDisplayName ?: ""
            aboutTextView.text = intentAbout ?: ""
            // If an avatar URL was passed as an extra, you might load it here as well.
            // For now, fall back to observing the user's avatar:
            runCatching {
                loadAvatar(
                    session,
                    avatarImageView,
                    intentAvartarUrl,
                    intentDisplayName
                )
            }
                .onFailure { e ->
                    Log.e(
                        "ProfileActivity",
                        "Error observing avatar for passed user",
                        e
                    )
                }
        } else {
            // Otherwise, load the profile info from the session (i.e. for the current user)
            lifecycleScope.launch {
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
                                    Log.e("ProfileActivity", "Error retrieving name", e)
                                    Toast.makeText(
                                        this@ProfileActivity,
                                        "Unable to retrieve info, please check your internet connection",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                    "__"
                                }
                            }
                        }
                    }
                    matrixIdText.text = session.myUserId
                    nameTextView.text = displayName

                    // (Optional) Fetch About info similarly if available from your profile service

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

                                is IOException -> Log.e(
                                    "NetworkError",
                                    "Network error: ${e.message}"
                                )

                                else -> Log.e("ProfileActivity", "Error retrieving avatar URL", e)
                            }
                            ""
                        }
                    }

                    // Load or observe Avatar based on URL
                    if (avatarUrl.isBlank()) {
                        runCatching { observeUserAvatar(session, avatarImageView) }
                            .onFailure { e ->
                                Log.e("ProfileActivity", "Error observing user avatar", e)
                            }
                    } else {
                        runCatching { loadAvatar(session, avatarImageView, avatarUrl) }
                            .onFailure { e ->
                                Log.e("ProfileActivity", "Error loading avatar", e)
                            }
                    }

                } catch (e: CancellationException) {
                    Log.e("CoroutineCancelled", "Coroutine was cancelled", e)
                    throw e
                } catch (e: Exception) {
                    Log.e("ProfileActivity", "Unexpected error in coroutine", e)
                }
            }
        }

        // Set up the logout button
        logoutButton.setOnClickListener {
            signOut(progressBar)
        }

        back.setOnClickListener {
            finish()
        }

        forgotPass.setOnClickListener {
            startActivity(Intent(this@ProfileActivity, RecoveryActivity::class.java))

        }
        avatarImageView.setOnClickListener {
            selectAvatarImage()
        }
        updateBtn.setOnClickListener {
            update(progressBar)
        }
        copyId.setOnClickListener {
            copySeedPhraseToClipboard(matrixIdText.text.toString(), "Matrix Id")
        }
        copyName.setOnClickListener {
            copySeedPhraseToClipboard(nameTextView.text.toString(), "Username")
        }
        copyAbout.setOnClickListener {
            copySeedPhraseToClipboard(aboutTextView.text.toString(), "About")
        }


    }

    private fun update(progressBar: ProgressBar) {
        progressBar.visibility = View.VISIBLE
        try {
            progressBar.visibility = View.VISIBLE
            lifecycleScope.launch {
                avatarUri?.let { uri ->
                    uploadAndSetAvatar(
                        session,
                        uri,
                        applicationContext,
                        homeserver
                    )
                    progressBar.visibility = View.GONE
                } ?: run {
                    val accessToken = session.sessionParams?.credentials?.accessToken
                        ?: throw IllegalStateException("Access token not available")
                    updateAvatar(session, "", homeserver, accessToken)
                    progressBar.visibility = View.GONE
                }
                Toast.makeText(
                    this@ProfileActivity,
                    "Updated avatar successfully",
                    Toast.LENGTH_SHORT
                ).show()
            }
        } catch (e: Exception) {
            Toast.makeText(this@ProfileActivity, "Updated avatar failed", Toast.LENGTH_SHORT).show()
        } finally {


        }
    }

    private fun signOut(progressBar: ProgressBar) {
        progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                session.signOutService().signOut(true)
            } catch (failure: Throwable) {
                runOnUiThread {
                    Toast.makeText(
                        this@ProfileActivity,
                        "Sign-out failed due to no network connection.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                return@launch
            } finally {
                progressBar.visibility = View.GONE
            }

            SessionHolder.currentSession = null
            startActivity(Intent(this@ProfileActivity, Login::class.java))
            val prefs: SharedPreferences? =
                getSharedPreferences(PasswordActivity.PREFS_NAME, Context.MODE_PRIVATE)
            prefs?.edit()?.clear()?.apply()
            finish()
        }
    }

    // Load profile image with Glide, or fallback to observe updates
    private fun loadAvatar(
        session: Session,
        imageView: ImageView,
        avatarUrl: String?,
        user: String? = null
    ) {
        try {
            if (!avatarUrl.isNullOrEmpty() && avatarUrl.startsWith("mxc://")) {
                val resolvedUrl = session.contentUrlResolver().resolveThumbnail(
                    avatarUrl,
                    100,
                    100,
                    ContentUrlResolver.ThumbnailMethod.SCALE
                )?.replace("/_matrix/media/r0/", "/_matrix/client/v1/media/")

                if (resolvedUrl != null) {
                    val accessToken = session.sessionParams?.credentials?.accessToken ?: ""
                    val glideUrl = GlideUrl(
                        resolvedUrl,
                        LazyHeaders.Builder()
                            .addHeader("Authorization", "Bearer $accessToken")
                            .build()
                    )
                    Glide.with(imageView.context)
                        .load(glideUrl)
                        .placeholder(R.drawable.user_default) // your placeholder drawable
                        .error(R.drawable.user_default)       // your error drawable
                        //.circleCrop()
                        .into(imageView)
                    progressBar.visibility = View.GONE
                } else {
                    observeUserAvatar(session, imageView, user)
                }
            } else {
                observeUserAvatar(session, imageView, user)
            }
        } catch (e: IOException) {
            Log.e("NetworkError", "No Internet Connection: ${e.message}")
            progressBar.visibility = View.GONE
        } catch (e: UnknownHostException) {
            Log.e("NetworkError", "No Internet Connection: ${e.message}")
            progressBar.visibility = View.GONE
        } catch (e: Exception) {
            Log.e("APIError", "Something went wrong: ${e.message}")
            progressBar.visibility = View.GONE
        }
    }

    // Fallback: Listen to user profile updates for the avatar
    private fun observeUserAvatar(session: Session, imageView: ImageView, user: String? = null) {
        if (user != null) {
            avatarRenderer.render(user, imageView)
        } else {
            //session.userService().getUserLive(session.myUserId)
            //.observe(this) { user ->
            //val userMatrixItem = user.map { it.toMatrixItem() }.getOrNull() ?: return@observe
            //avatarRenderer.render(userMatrixItem, imageView)
            //}
            session.userService()
                .getUserLive(session.myUserId)
                .observeOnce(this) { user ->
                    user.map { it.toMatrixItem() }
                        .getOrNull()
                        ?.let { avatarRenderer.render(it, imageView) }
                }

        }
        progressBar.visibility = View.GONE
    }

    fun <T> LiveData<T>.observeOnce(lifecycleOwner: LifecycleOwner, observer: (T) -> Unit) {
        observe(lifecycleOwner, object : Observer<T> {
            override fun onChanged(value: T) {
                observer(value)
                removeObserver(this)
            }
        })
    }

    private fun String.toSentenceCase(): String {
        return this.lowercase()
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }

    private fun copySeedPhraseToClipboard(text: String, title: String) {
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(title, text)
        clipboard.setPrimaryClip(clip)
        // Optionally, show a toast to notify the user.
        Toast.makeText(this@ProfileActivity, "$title copied!", Toast.LENGTH_SHORT).show()
    }

    /**
     * Initiates an intent to select an image from the gallery.
     */
    private fun selectAvatarImage() {
        // Call this when you want to select an image
        pickImageLauncher.launch("image/*")

    }


    /**
     * Uploads the avatar image to the Matrix media store and updates the user profile.
     */
    private suspend fun uploadAndSetAvatar(
        session: Session,
        fileUri: Uri,
        context: Context,
        homeserver: String // Pass homeserver as a parameter
    ) {
        val accessToken = session.sessionParams?.credentials?.accessToken
            ?: throw IllegalStateException("Access token not available")

        // Read file bytes safely
        val inputStream = context.contentResolver.openInputStream(fileUri)
        val fileBytes = inputStream?.readBytes() ?: return
        inputStream.close()

        // Prepare Retrofit for media upload
        val mediaRetrofit = Retrofit.Builder()
            .baseUrl("$homeserver/_matrix/media/r0/") // Correct media upload base URL
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val mediaApi = mediaRetrofit.create(MediaApi::class.java)

        // Prepare request
        val requestBody = fileBytes.toRequestBody("image/jpeg".toMediaTypeOrNull())

        // Upload image
        val uploadResponse = mediaApi.uploadMedia(
            file = requestBody,
            filename = "avatar.jpg",
            authHeader = "Bearer $accessToken"
        )

        // Extract MXC URL from response
        val mxcUrl = uploadResponse.contentUri

        // Now update the avatar
        updateAvatar(session, mxcUrl, homeserver, accessToken)
    }

    private suspend fun updateAvatar(
        session: Session,
        mxcUrl: String,
        homeserver: String,
        accessToken: String
    ) {
        // Prepare Retrofit for profile updates
        val profileRetrofit = Retrofit.Builder()
            .baseUrl("$homeserver/_matrix/client/v3/") // Correct profile update base URL
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val profileApi = profileRetrofit.create(ProfileApi::class.java)

        // Send request to update avatar
        val response = profileApi.updateAvatarUrl(
            userId = session.myUserId,
            avatarUpdate = AvatarUpdateRequest(mxcUrl.toString()),
            authHeader = "Bearer $accessToken"
        )

        if (!response.isSuccessful) {
            throw RuntimeException("Failed to update avatar: ${response.errorBody()?.string()}")
        } else {
//            progress.visibility = View.GONE
//            Toast.makeText(this@ProfileActivity,"Updated avatar successfully")
        }
    }


    // Define an interface for the media upload endpoint:
    interface MediaApi {
        @POST("upload")
        suspend fun uploadMedia(
            @Body file: RequestBody,
            @Query("filename") filename: String,
            @Header("Authorization") authHeader: String // Pass dynamically when calling
        ): UploadResponse
    }


    data class UploadResponse(
        @SerializedName("content_uri")
        val contentUri: String
    )

    interface ProfileApi {
        @PUT("profile/{userId}/avatar_url")
        suspend fun updateAvatarUrl(
            @Path("userId") userId: String,
            @Body avatarUpdate: AvatarUpdateRequest,
            @Header("Authorization") authHeader: String
        ): Response<Unit>
    }

    data class AvatarUpdateRequest(
        @SerializedName("avatar_url") val avatarUrl: String
    )


}
