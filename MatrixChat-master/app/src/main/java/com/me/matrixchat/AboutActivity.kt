package com.me.matrixchat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.Html
import android.text.Spannable
import android.text.SpannableString
import android.text.style.StyleSpan
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class AboutActivity : AppCompatActivity() {

    private lateinit var bitcoinAddressText: TextView
    private lateinit var moneroAddressText: TextView
    private lateinit var bitcoinCopyIcon: ImageView
    private lateinit var moneroCopyIcon: ImageView
    private lateinit var backIcon: ImageView
    private lateinit var aboutText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_about) // adjust if your layout file has a different name

        // Initialize views
        bitcoinAddressText = findViewById(R.id.bitcoinAddress)
        moneroAddressText = findViewById(R.id.moneroAddress)
        bitcoinCopyIcon = findViewById(R.id.bitcoinCopy)
        moneroCopyIcon = findViewById(R.id.moneroCopy)
        backIcon = findViewById(R.id.imageView2)
        aboutText = findViewById(R.id.aboutText)

        // Set About Us formatted text
        val rawText = getString(R.string.about_us_full_text)
        boldifyText(aboutText, rawText)

        val aboutText1 = findViewById<TextView>(R.id.aboutText1)
        val rawText1 = getString(R.string.about_us_full_text1)
        boldifyText(aboutText1, rawText1)

        val aboutText2 = findViewById<TextView>(R.id.aboutText2)
        val rawText2 = getString(R.string.about_us_full_text2)
        boldifyText(aboutText2, rawText2)

        val aboutText3 = findViewById<TextView>(R.id.aboutText3)
        val rawText3 = getString(R.string.about_us_full_text3)
        boldifyText(aboutText3, rawText3)

        val aboutText4 = findViewById<TextView>(R.id.aboutText4)
        val rawText4 = getString(R.string.about_us_full_text4)
        boldifyText(aboutText4, rawText4)



        // Copy actions
        bitcoinCopyIcon.setOnClickListener {
            copyToClipboard("Bitcoin Address", bitcoinAddressText.text.toString())
        }

        moneroCopyIcon.setOnClickListener {
            copyToClipboard("Monero Address", moneroAddressText.text.toString())
        }

        // Back button
        backIcon.setOnClickListener {
            finish() // or use onBackPressedDispatcher.onBackPressed()
        }
    }

    private fun copyToClipboard(label: String, text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(label, text)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this, "$label copied to clipboard", Toast.LENGTH_SHORT).show()
    }
    private fun boldifyText(textView: TextView, fullText: String) {
        val spannable = SpannableString(fullText)

        val boldPhrases = listOf(
            "MatrixChat",
            "VPN",
            "Matrix server protocol",
            "PGP encryption",
            "12 words",
            "Write it down!",
            "recovery seed",
            "forget the password",
            "We don't store any IP logs!",
            "email address or phone number"
        )

        boldPhrases.forEach { phrase ->
            val start = fullText.indexOf(phrase)
            if (start >= 0) {
                spannable.setSpan(
                    StyleSpan(Typeface.BOLD),
                    start,
                    start + phrase.length,
                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }
        }

        textView.text = spannable
    }

}
