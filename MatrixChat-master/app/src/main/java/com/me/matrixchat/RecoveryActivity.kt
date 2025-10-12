package com.me.matrixchat

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.io.IOException
import java.security.MessageDigest

class RecoveryActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private lateinit var homeserver: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_recovery)
        homeserver = getString(R.string.homeserver_url)
        val editTextUsername = findViewById<EditText>(R.id.editTextUsername)
        val editTextSeedPhrase = findViewById<EditText>(R.id.editTextSeedPhrase)
        val editTextNewPassword = findViewById<EditText>(R.id.editTextNewPassword)
        val buttonResetPassword = findViewById<Button>(R.id.buttonResetPassword)
        val progressBar = findViewById<ProgressBar>(R.id.loginProgressBar)

        buttonResetPassword.setOnClickListener {
            progressBar.visibility = View.VISIBLE
            val name = editTextUsername.text.toString().trim()
            val seedPhrase = editTextSeedPhrase.text.toString().trim()
            val newPassword = editTextNewPassword.text.toString().trim()
            val username = "@$name:matrixchat"

            if (username.isEmpty() || seedPhrase.isEmpty() || newPassword.isEmpty()) {
                Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                progressBar.visibility = View.GONE
                return@setOnClickListener
            }


            // Hash the seed phrase using SHA-256
            val seedHash = hashSeedPhrase(seedPhrase)

            // Verify the recovery key via backend API
            lifecycleScope.launch {
                verifyRecoveryKey(username, seedHash) { verified ->
                    runOnUiThread {
                        if (verified) {
                            // If recovery key verified, update the password
                            updatePassword(name, newPassword) { success ->
                                runOnUiThread {
                                    if (success) {
                                        Toast.makeText(this@RecoveryActivity, "Password reset successfully", Toast.LENGTH_SHORT).show()
                                        // Optionally, navigate to the login activity:
                                        progressBar.visibility = View.GONE
                                        startActivity(Intent(this@RecoveryActivity, Login::class.java))
                                        finish()
                                    } else {
                                        progressBar.visibility = View.GONE
                                        Toast.makeText(this@RecoveryActivity, "Password reset failed", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        } else {
                            progressBar.visibility = View.GONE
                            Toast.makeText(this@RecoveryActivity, "Invalid recovery key", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        }
    }

    private fun hashSeedPhrase(seed: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(seed.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    // Retrofit‑based method to verify the recovery key
    private fun verifyRecoveryKey(userId: String, seedHash: String, callback: (Boolean) -> Unit) {
        val retrofit = Retrofit.Builder()
            .baseUrl("$homeserver/")  // Ensure trailing slash
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val recoveryApi = retrofit.create(RecoveryApi::class.java)

        lifecycleScope.launch {
            try {
                val request = RecoveryKeyRequest(userId = userId, recoveryKeyHash = seedHash)
                val response = recoveryApi.verifyRecoveryKey(request)
                runOnUiThread {
                    callback(response.isSuccessful)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    callback(false)
                }
            }
        }
    }


    private fun updatePassword(userId: String, newPassword: String, callback: (Boolean) -> Unit) {
        val retrofit = Retrofit.Builder()
            .baseUrl("$homeserver/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val recoveryApi = retrofit.create(RecoveryApi::class.java)

        lifecycleScope.launch {
            try {
                val response = recoveryApi.updatePassword(UpdatePasswordRequest(userId, newPassword))
                runOnUiThread {
                    if (response.isSuccessful) {
                        Toast.makeText(this@RecoveryActivity, "Password reset successfully", Toast.LENGTH_SHORT).show()
                        callback(true)
                    } else {
                        Toast.makeText(this@RecoveryActivity, "Password reset failed: ${response.errorBody()?.string()}", Toast.LENGTH_SHORT).show()
                        callback(false)
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@RecoveryActivity, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
                callback(false)
            }
        }
    }


    data class UpdatePasswordRequest(
        @SerializedName("user_id") val userId: String,
        @SerializedName("new_password") val newPassword: String
    )



    // Data class representing the request body
    data class RecoveryKeyRequest(
        @SerializedName("user_id")
        val userId: String,
        @SerializedName("recovery_key_hash")
        val recoveryKeyHash: String
    )

    // API interface for the recovery key verification endpoint
    interface RecoveryApi {
        @POST("api/api/verifyRecoveryKey")
        suspend fun verifyRecoveryKey(
            @Body request: RecoveryKeyRequest
        ): Response<Void>

        @POST("api/api/resetPasswordAdmin")
        suspend fun updatePassword(@Body request: UpdatePasswordRequest): Response<Void>
    }

}
