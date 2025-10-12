package com.me.matrixchat.Views;

import android.content.Context;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.me.matrixchat.R;

public class SeedView extends LinearLayout {
    private TextView seedTextView;

    public SeedView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    private void init(Context context) {
        LayoutInflater.from(context).inflate(R.layout.custom_seed_text, this, true);
        seedTextView = findViewById(R.id.seedtext);
    }

    public void setSeedText(String text) {
        if (seedTextView != null) {
            seedTextView.setText(text);
        }
    }
}
