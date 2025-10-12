package com.me.matrixchat

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.util.Log
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.gson.annotations.SerializedName
import com.me.matrixchat.ui.MainActivity
import com.squareup.moshi.Json
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.matrix.android.sdk.api.Matrix
import org.matrix.android.sdk.api.auth.AuthenticationService
import org.matrix.android.sdk.api.auth.data.HomeServerConnectionConfig
import org.matrix.android.sdk.api.auth.registration.RegistrationResult
import org.matrix.android.sdk.api.failure.Failure
import org.matrix.android.sdk.api.session.media.MediaService
import org.matrix.android.sdk.api.session.Session
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Query
import java.util.concurrent.Executors
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path


class SignUp : AppCompatActivity() {

    companion object {
        private const val REQUEST_CODE_SELECT_AVATAR = 1001
    }

    private lateinit var matrix: Matrix
    private lateinit var authService: AuthenticationService
    private val executor = Executors.newSingleThreadExecutor()

    private val pickImageLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri != null) {
                avatarUri = uri
                findViewById<ImageView>(R.id.profile).setImageURI(uri)
            } else {
                Log.e("MatrixChat", "No image selected")
            }
        }


    // This variable will hold the Uri of the selected avatar image
    private var avatarUri: Uri? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_signup)

        // Initialize UI elements
        val userNameText = findViewById<EditText>(R.id.usernameText)
        val passwordText = findViewById<EditText>(R.id.passwordText)
        val loginButton = findViewById<TextView>(R.id.signIn)
        val progressBar = findViewById<ProgressBar>(R.id.progressBar)
        val signupButton = findViewById<TextView>(R.id.signupButton)
        val profileImageViewSelect = findViewById<ImageView>(R.id.profile)
        val hideImageView = findViewById<ImageView>(R.id.hide)

        // Initialize Matrix SDK
        matrix = MyApplication.getMatrix(applicationContext)
        authService = matrix.authenticationService()

        userNameText.addTextChangedListener(object : TextWatcher {
            private var currentText = ""

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                val input = s.toString()
                val sentenceCased = input.toSentenceCase()

                // Prevent infinite loop by only updating if different
                if (input != sentenceCased) {
                    userNameText.removeTextChangedListener(this)
                    userNameText.setText(sentenceCased)
                    userNameText.setSelection(sentenceCased.length)
                    userNameText.addTextChangedListener(this)
                }
            }
        })


        hideImageView.setOnClickListener {
            if (passwordText.transformationMethod is PasswordTransformationMethod) {
                // Currently hidden: show password
                passwordText.transformationMethod = HideReturnsTransformationMethod.getInstance()
                hideImageView.setImageResource(R.drawable.show)
            } else {
                // Currently visible: hide password
                passwordText.transformationMethod = PasswordTransformationMethod.getInstance()
                hideImageView.setImageResource(R.drawable.hide)
            }
            // Keep the cursor at the end of the text
            passwordText.setSelection(passwordText.text.length)
        }

        // Set up click listener for avatar selection
        profileImageViewSelect.setOnClickListener {
            selectAvatarImage()
        }

        // Sign-up button click listener
        signupButton.setOnClickListener {
            val userName = userNameText.text.toString().trim()
            val password = passwordText.text.toString().trim()

            if (userName.isEmpty() || password.isEmpty() || avatarUri == null) {
                Toast.makeText(
                    this,
                    "Please fill all fields and select an image",
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }

            // Proceed with sign-up
            signUp(userName, password, progressBar)
        }

        // Navigate to Login screen
        loginButton.setOnClickListener {
            val intent = Intent(this, Login::class.java)
            startActivity(intent)
            finish()
        }
    }

    private fun signUp(userName: String, password: String, progressBar: ProgressBar) {
        progressBar.visibility = View.VISIBLE

        val homeserver = getString(R.string.homeserver_url)
        val homeServerConnectionConfig = try {
            HomeServerConnectionConfig.Builder()
                .withHomeServerUri(Uri.parse(homeserver))
                .build()
        } catch (failure: Throwable) {
            Log.e("MatrixChat", failure.stackTraceToString())
            progressBar.visibility = View.GONE
            return
        }

        lifecycleScope.launch {
            try {
                // Fetch registration flow (if needed)
                authService.getLoginFlow(homeServerConnectionConfig)

                val registrationWizard = authService.getRegistrationWizard()
                // First, attempt to create the account.
                val initialResult = registrationWizard.createAccount(userName, password, null)
                Log.d("MatrixChat", "Registration result: $initialResult")


                when (initialResult) {
                    is RegistrationResult.FlowResponse -> {
                        val missingStages =
                            initialResult.flowResult.missingStages.map { it.toString() }

                        if ("Dummy(mandatory=true)" in missingStages) {
                            val dummyResult = registrationWizard.dummy()

                            if (dummyResult is RegistrationResult.Success) {
                                true
                                // Dummy stage completed successfully
                                // After successful registration, upload avatar if selected
                                avatarUri?.let { uri ->
                                    val accessToken =
                                        dummyResult.session.sessionParams?.credentials?.accessToken

                                    uploadAndSetAvatar(
                                        dummyResult.session,
                                        uri,
                                        applicationContext,
                                        homeserver
                                    )
                                }

                                // Complete registration
                                onRegistrationSuccess(dummyResult.session)
                                progressBar.visibility = View.GONE
                            } else {
                                Log.e("MatrixChat", "Dummy authentication failed.")
                                progressBar.visibility = View.GONE
                            }
                        }
                    }

                    is RegistrationResult.Success -> {
                        val accessToken =
                            initialResult.session.sessionParams?.credentials?.accessToken
                        // After successful registration, upload avatar if selected
                        avatarUri?.let { uri ->


                            uploadAndSetAvatar(
                                initialResult.session,
                                uri,
                                applicationContext,
                                homeserver
                            )
                        }

                        // Complete registration
                        onRegistrationSuccess(initialResult.session)
                    }

                    else -> {
                        Log.e("MatrixChat", "Unknown registration error")
                        Toast.makeText(
                            applicationContext,
                            "Unknown registration error",
                            Toast.LENGTH_SHORT
                        ).show()
                    }

                }
                progressBar.visibility = View.GONE

            } catch (failure: Failure) {
                val errorMessage = failure.localizedMessage ?: "Registration failed"
                val readableMessage = when {
                    errorMessage.contains("MatrixError") -> {
                        val regex = """message=(.*?),""".toRegex()
                        val matchResult = regex.find(errorMessage)
                        matchResult?.groupValues?.get(1) ?: "Sign-up failed due to an unknown error."
                    }
                    errorMessage.contains("Unable to resolve host") -> {
                        "Network error: Unable to reach the server. Please check your internet connection."
                    }
                    else -> errorMessage
                }


                Toast.makeText(
                    applicationContext,
                    "Sign-up failed: $readableMessage",
                    Toast.LENGTH_SHORT
                ).show()
                Log.e("MatrixChat", "Sign-up failed: $errorMessage")
                progressBar.visibility = View.GONE
            }
        }


    }

    private fun onRegistrationSuccess(session: Session) {
        Toast.makeText(applicationContext, "Welcome ${session.myUserId}", Toast.LENGTH_SHORT).show()
        SessionHolder.setCurrentSession(session)
        session.open()
        session.syncService().startSync(true)
        // Navigate to the next screen if needed
        val intent = Intent(applicationContext, SeedPhraseActivity::class.java)
        intent.putExtra("matrix_user_id", session.myUserId)
        startActivity(intent)
        finish()
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
    private fun String.toSentenceCase(): String {
        return this.lowercase()
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }


}
