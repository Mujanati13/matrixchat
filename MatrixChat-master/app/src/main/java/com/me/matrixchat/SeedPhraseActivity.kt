package com.me.matrixchat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.me.matrixchat.Views.SeedView
import kotlinx.coroutines.launch
import org.bitcoinj.crypto.MnemonicCode
import org.matrix.android.sdk.api.Matrix
import java.security.SecureRandom
import android.util.Base64
import com.google.gson.annotations.SerializedName
import java.security.MessageDigest
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.io.IOException



class SeedPhraseActivity : AppCompatActivity() {

    private lateinit var matrix: Matrix

    // Simulated 20-word seed phrase. In production, generate this securely.
    private val seedPhraseWords = generateBip39SeedPhrase()

    // The full seed phrase string for copying.
    private val seedPhraseText: String = seedPhraseWords.joinToString(" ")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_seed_phrase)

        // Initialize Matrix SDK
        matrix = MyApplication.getMatrix(applicationContext)




        // Find views
        val copyIcon = findViewById<ImageView>(R.id.imageView4)
        val signUpButton = findViewById<Button>(R.id.signupButton)



        // Populate the SeedViews with seed phrase words.
        // Since our layout doesn't have an id on the FlexboxLayout,
        // we'll traverse the entire view hierarchy to locate all SeedView instances.
        val rootView = findViewById<ViewGroup>(R.id.main)
        val seedViews = mutableListOf<SeedView>()
        traverseAndCollectSeedViews(rootView, seedViews)

        // Check that we have enough SeedViews to display all words.
        // (If there are fewer SeedViews than words, assign only to available ones.)
        for ((index, word) in seedPhraseWords.withIndex()) {
            if (index < seedViews.size) {
                seedViews[index].setSeedText(word)
            }
        }
        val seedPhraseBase64 = Base64.encodeToString(
            seedPhraseText.toByteArray(Charsets.UTF_8),
            Base64.NO_WRAP
        )


        // Set up copy functionality.
        copyIcon.setOnClickListener {
            copySeedPhraseToClipboard(seedPhraseText)
        }

        // Set up sign up button to continue registration.
        signUpButton.setOnClickListener {
            lifecycleScope.launch {
                try {
                    // Hash the seed phrase.
                    val recoveryHash = hashSeedPhrase(seedPhraseText)

                    // Assume you have the user’s Matrix ID (e.g., passed from a previous registration step).
                    // For this example, let's assume it's passed as an Intent extra:
                    val matrixUserId = intent.getStringExtra("matrix_user_id") ?: ""

                    // Store the recovery key hash on your backend.
                    storeRecoveryKey(matrixUserId, recoveryHash) { success ->
                        runOnUiThread {
                            if (success) {
                                Toast.makeText(applicationContext, "Recovery Key saved successfully!", Toast.LENGTH_SHORT).show()
                                // Continue with registration success flow.
                                val intent = Intent(this@SeedPhraseActivity, PasswordActivity::class.java)
                                startActivity(intent)
                                finish()
                            } else {
                                Toast.makeText(applicationContext, "Failed to save recovery key!", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                } catch (e: Exception) {
                    Toast.makeText(applicationContext, "Recovery Key save failed!", Toast.LENGTH_SHORT).show()
                    Log.e("MatrixChat", "Error saving recovery key", e)
                }
            }
        }

    }

    /**
     * Recursively traverse the view hierarchy starting from [view]
     * and add any SeedView instances to [result].
     */
    private fun traverseAndCollectSeedViews(view: View, result: MutableList<SeedView>) {
        if (view is SeedView) {
            result.add(view)
        } else if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                traverseAndCollectSeedViews(view.getChildAt(i), result)
            }
        }
    }

    /**
     * Copies the full seed phrase to the clipboard.
     */
    private fun copySeedPhraseToClipboard(text: String) {
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Seed Phrase", text)
        clipboard.setPrimaryClip(clip)
        // Optionally, show a toast to notify the user.
        Toast.makeText(this@SeedPhraseActivity, "Seed phrase copied!", Toast.LENGTH_SHORT).show()
    }


    fun generateBip39SeedPhrase(): List<String> {
        val random = SecureRandom()
        val entropy = ByteArray(16) // 128-bit entropy for 12 words, use 32 bytes for 24 words
        random.nextBytes(entropy)
        return MnemonicCode.INSTANCE.toMnemonic(entropy)
    }

    private fun hashSeedPhrase(seed: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(seed.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    // Data class representing the request body for storing the recovery key
    data class StoreRecoveryRequest(
        @SerializedName("user_id") val userId: String,
        @SerializedName("recovery_key_hash") val recoveryKeyHash: String
    )

    // API interface for the store recovery key endpoint
    interface StoreRecoveryApi {
        @POST("api/api/storeRecoveryKey")
        suspend fun storeRecoveryKey(
            @Body request: StoreRecoveryRequest
        ): retrofit2.Response<Void>
    }

    // Retrofit‑based method to store the recovery key
    private fun storeRecoveryKey(userId: String, recoveryKeyHash: String, callback: (Boolean) -> Unit) {
        val retrofit = Retrofit.Builder()
            .baseUrl(getString(R.string.homeserver_url)+"/")  // e.g. "https://matrixsynapsechat.duckdns.org/"
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val storeRecoveryApi = retrofit.create(StoreRecoveryApi::class.java)

        lifecycleScope.launch {
            try {
                val request = StoreRecoveryRequest(userId, recoveryKeyHash)
                val response = storeRecoveryApi.storeRecoveryKey(request)
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

}
