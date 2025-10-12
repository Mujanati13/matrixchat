package com.me.matrixchat

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.matrix.android.sdk.api.Matrix
import org.matrix.android.sdk.api.auth.AuthenticationService
import org.matrix.android.sdk.api.auth.data.HomeServerConnectionConfig
import java.util.concurrent.Executors

class Login : AppCompatActivity() {

    private lateinit var matrix: Matrix
    private lateinit var authService: AuthenticationService
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // Initialize UI elements
        val matrixIdText = findViewById<EditText>(R.id.matrixIdText)
        val passwordText = findViewById<EditText>(R.id.passwordText)
        val loginButton = findViewById<Button>(R.id.loginButton)
        val progressBar = findViewById<ProgressBar>(R.id.loginProgressBar)
        val signupButton = findViewById<TextView>(R.id.signIn)
        val hideImageView = findViewById<ImageView>(R.id.hide)
        val recover = findViewById<TextView>(R.id.forgotText)

        matrixIdText.addTextChangedListener(object : TextWatcher {
            private var currentText = ""

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                val input = s.toString()
                val sentenceCased = input.toSentenceCase()

                // Prevent infinite loop by only updating if different
                if (input != sentenceCased) {
                    matrixIdText.removeTextChangedListener(this)
                    matrixIdText.setText(sentenceCased)
                    matrixIdText.setSelection(sentenceCased.length)
                    matrixIdText.addTextChangedListener(this)
                }
            }
        })


        // Initialize Matrix SDK
        matrix = MyApplication.getMatrix(applicationContext)
        authService = matrix.authenticationService()

        // Check if user is already logged in
        val session = authService.getLastAuthenticatedSession()

        if (session != null && session.isOpenable) {
            try {
                session?.open()
                // User is logged in, redirect to PinActivity
                val intent = Intent(this@Login, PasswordActivity::class.java)
                startActivity(intent)
                finish()
                return
            } catch (e: AssertionError) {
                Log.e("Matrix:", "Assertion failed: ${e.message}")
                val intent = Intent(this@Login, PasswordActivity::class.java)
                startActivity(intent)
                finish()
                return
                //Toast.makeText(this, "Assertion failed: ${e.message}", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e("Matrix:", "Exception: ${e.message}")
                Toast.makeText(this, "Exception: ${e.message}", Toast.LENGTH_SHORT).show();
            }



        }

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

        // Login button click listener
        loginButton.setOnClickListener {
            val matrixId = matrixIdText.text.toString().trim()
            val password = passwordText.text.toString().trim()

            if (matrixId.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            login(matrixId, password, progressBar)
        }
        signupButton.setOnClickListener {
            val intent = Intent(this, SignUp::class.java)
            startActivity(intent)
            //finish()
        }
        recover.setOnClickListener {
            val intent = Intent(this, RecoveryActivity::class.java)
            startActivity(intent)
            //finish()
        }

    }

    private fun login(
        matrixId: String,
        password: String,
        progressBar: ProgressBar
    ) {
        progressBar.visibility = View.VISIBLE

        val homeserver = getString(R.string.homeserver_url)

        // First, create a homeserver config
        // Be aware than it can throw if you don't give valid info
        val homeServerConnectionConfig = try {
            HomeServerConnectionConfig
                .Builder()
                .withHomeServerUri(Uri.parse(homeserver))
                .build()
        } catch (failure: Throwable) {
            Log.e("MatrixChat", failure.stackTraceToString())
            return
        }
        // Then you can retrieve the authentication service.
        // Here we use the direct authentication, but you get LoginWizard and RegistrationWizard for more advanced feature
        //
        lifecycleScope.launch {
            try {
                val session = withContext(Dispatchers.IO) {
                    MyApplication.getMatrix(applicationContext).authenticationService()
                        .directAuthentication(
                            homeServerConnectionConfig,
                            matrixId,
                            password,
                            "matrix-sdk-android2-sample"
                        )
                }

                withContext(Dispatchers.Main) {
                    session?.let {
                        if (!isFinishing) {
                            AlertDialog.Builder(this@Login)
                                .setTitle("Welcome")
                                .setMessage("Welcome ${it.myUserId}")
                                .setPositiveButton("OK") { dialog, _ -> dialog.dismiss() }
                                .show()
                        }

                        SessionHolder.setCurrentSession(it)
                        it.open()
                        it.syncService().startSync(true)

                        val intent = Intent(applicationContext, PasswordActivity::class.java)
                        startActivity(intent)
                        finish()
                    }
                }
            } catch (failure: Throwable) {
                withContext(Dispatchers.Main) {
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

                    if (!isFinishing) {
                        AlertDialog.Builder(this@Login)
                            .setTitle("Failure")
                            .setMessage(readableMessage)
                            .setPositiveButton("OK") { dialog, _ -> dialog.dismiss() }
                            .show()
                    }
                    Log.e("Matrix:", "$failure")
                    progressBar.visibility = View.GONE
                }
            }

            //}

//        executor.execute {
//            try {
//                // Step 1: Fetch login flow
//                authService.getLoginWizard().getLoginFlow(homeServer).getOrThrow()
//                Log.d("MatrixLogin", "Supported login flows retrieved.")
//
//                // Step 2: Perform login
//                val sessionParams = authService.getLoginWizard().login(username, password, homeServer, null).getOrThrow()
//                runOnUiThread {
//                    progressBar.visibility = View.GONE
//                    Toast.makeText(this, "Login successful!", Toast.LENGTH_SHORT).show()
//                    Log.d("MatrixLogin", "Login successful: ${sessionParams.userId}")
//                    // Navigate to the next activity (e.g., HomeActivity)
//                }
//            } catch (e: Exception) {
//                runOnUiThread {
//                    progressBar.visibility = View.GONE
//                    Toast.makeText(this, "Login failed: ${e.message}", Toast.LENGTH_LONG).show()
//                    Log.e("MatrixLogin", "Login failed", e)
//                }
//            }
//        }
        }
    }
    private fun String.toSentenceCase(): String {
        return this.lowercase()
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
}
