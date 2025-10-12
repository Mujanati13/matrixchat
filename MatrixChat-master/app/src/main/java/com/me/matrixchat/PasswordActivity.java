package com.me.matrixchat;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;


import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;

import android.util.Base64;

import com.me.matrixchat.ui.MainActivity;


public class PasswordActivity extends AppCompatActivity {
    public static final String PREFS_NAME = "secure_prefs";
    private static final String KEY_PIN = "encrypted_pin";
    private static final String KEY_IV = "encryption_iv";
    private static final String KEY_AES = "aes_key"; // Store AES key safely
    private static final String AES_MODE = "AES/CBC/PKCS5Padding"; // Fix missing mode
    // Add these to the top of your class
    private static final int MAX_ATTEMPTS = 3;          // The max number of allowed attempts
    private static final String KEY_ATTEMPTS_LEFT = "attempts_left";

    private EditText passwordText;
    private ImageView imageView3;
    private Button signupButton;
    private TextView title;

    private boolean isSettingPin = false; // Dynamic mode flag


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_password);

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        // Initialize attempts left if not present
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (!prefs.contains(KEY_ATTEMPTS_LEFT)) {
            prefs.edit().putInt(KEY_ATTEMPTS_LEFT, MAX_ATTEMPTS).apply();
        }

        passwordText = findViewById(R.id.passwordText);
        imageView3 = findViewById(R.id.imageView3);
        signupButton = findViewById(R.id.signupButton);
        title = findViewById(R.id.title);

        isSettingPin = !isPinSet(); // If PIN is not set, enter setting mode

        if (isSettingPin) {
            title.setText("Set PIN");
            signupButton.setText("Save PIN");
        } else {
            title.setText("Enter PIN");
            signupButton.setText("Verify");
        }

        imageView3.setOnClickListener(v -> togglePasswordVisibility());
        signupButton.setOnClickListener(v -> handlePinAction());
    }

    private void handlePinAction() {
        String enteredPin = passwordText.getText().toString().trim();

        if (enteredPin.isEmpty()) {
            Toast.makeText(this, "Please enter a PIN", Toast.LENGTH_SHORT).show();
            return;
        }

        if (isSettingPin) {
            saveEncryptedPin(enteredPin);
            //Toast.makeText(this, "PIN saved successfully!", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(PasswordActivity.this, MainActivity.class));
            finish();
        } else {
            if (verifyPin(enteredPin)) {
                //Toast.makeText(this, "PIN verified! Access granted.", Toast.LENGTH_SHORT).show();
                // Proceed to the next screen (if needed)
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putInt(KEY_ATTEMPTS_LEFT, MAX_ATTEMPTS).apply();
                startActivity(new Intent(PasswordActivity.this, MainActivity.class));
                finish();
            } else {
                // Wrong PIN
                passwordText.setText("");
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                int attemptsLeft = prefs.getInt(KEY_ATTEMPTS_LEFT, MAX_ATTEMPTS);

                // Decrement attempts
                attemptsLeft--;
                prefs.edit().putInt(KEY_ATTEMPTS_LEFT, attemptsLeft).apply();

                // Show dialog with attempts left
                showAttemptsLeftDialog(attemptsLeft);

                // If no attempts left, clear app data
                if (attemptsLeft <= 0) {
                    clearAppData();
                }
            }
        }
    }
    private void showAttemptsLeftDialog(int attemptsLeft) {
        android.app.AlertDialog.Builder builder = new android.app.AlertDialog.Builder(this);
        builder.setTitle("Attempt left (" + attemptsLeft + ")");
        builder.setMessage("Once attempts are exhausted, the app resets.");
        builder.setPositiveButton("Ok", null);
        builder.show();
    }
    private void clearAppData() {
        // 1) Show a dialog that notifies user
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Clearing Data");
        builder.setMessage("Clearing data and closing application...");
        builder.setCancelable(false); // Prevent dismiss by back button or touch outside

        final AlertDialog dialog = builder.create();
        dialog.show();

        // 2) Wait 3 seconds, then clear app data
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            dialog.dismiss();

            // Attempt to clear data (this kills the app process immediately if it succeeds)
            try {
                String packageName = getApplicationContext().getPackageName();
                Runtime.getRuntime().exec("pm clear " + packageName);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, 3000);
    }




    private void togglePasswordVisibility() {
        if (passwordText.getInputType() == (InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD)) {
            passwordText.setInputType(InputType.TYPE_CLASS_NUMBER);
            imageView3.setImageResource(R.drawable.show); // Change icon
        } else {
            passwordText.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
            imageView3.setImageResource(R.drawable.hide); // Change icon
        }
        passwordText.setSelection(passwordText.getText().length()); // Maintain cursor position
    }

    private boolean isPinSet() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.contains(KEY_PIN);
    }

    // 🔐 Store PIN Securely
    public void saveEncryptedPin(String pin) {
        try {
            SecretKey key = getAESKey(); // Retrieve stored key
            IvParameterSpec iv = generateIV();
            String encryptedPin = encrypt(pin, key, iv);

            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_PIN, encryptedPin);
            editor.putString(KEY_IV, Base64.encodeToString(iv.getIV(), Base64.DEFAULT));
            editor.apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 🔐 Verify PIN
    public boolean verifyPin(String inputPin) {
        try {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String encryptedPin = prefs.getString(KEY_PIN, null);
            String storedIV = prefs.getString(KEY_IV, null);

            if (encryptedPin == null || storedIV == null) return false;

            SecretKey key = getAESKey(); // Use the same key
            IvParameterSpec iv = new IvParameterSpec(Base64.decode(storedIV, Base64.DEFAULT));

            String decryptedPin = decrypt(encryptedPin, key, iv);
            return inputPin.equals(decryptedPin);
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    // 🔑 Get or Generate AES Key (Avoid Re-generating Every Time)
    private SecretKey getAESKey() throws Exception {
        SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String encodedKey = prefs.getString(KEY_AES, null);

        if (encodedKey != null) {
            byte[] decodedKey = Base64.decode(encodedKey, Base64.DEFAULT);
            return new javax.crypto.spec.SecretKeySpec(decodedKey, "AES");
        } else {
            SecretKey key = generateAESKey();
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_AES, Base64.encodeToString(key.getEncoded(), Base64.DEFAULT));
            editor.apply();
            return key;
        }
    }

    // 📌 Generate AES Key
    private SecretKey generateAESKey() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
        keyGenerator.init(256); // Ensure 256-bit security
        return keyGenerator.generateKey();
    }

    // 📌 Generate IV
    private IvParameterSpec generateIV() {
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);
        return new IvParameterSpec(iv);
    }

    // 🔒 Encrypt Data
    private String encrypt(String data, SecretKey key, IvParameterSpec iv) throws Exception {
        Cipher cipher = Cipher.getInstance(AES_MODE);
        cipher.init(Cipher.ENCRYPT_MODE, key, iv);
        byte[] encryptedData = cipher.doFinal(data.getBytes());
        return Base64.encodeToString(encryptedData, Base64.DEFAULT);
    }

    // 🔑 Decrypt Data
    private String decrypt(String encryptedData, SecretKey key, IvParameterSpec iv) throws Exception {
        Cipher cipher = Cipher.getInstance(AES_MODE);
        cipher.init(Cipher.DECRYPT_MODE, key, iv);
        byte[] decodedData = Base64.decode(encryptedData, Base64.DEFAULT);
        return new String(cipher.doFinal(decodedData));
    }


}
