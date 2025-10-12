package com.me.matrixchat.Views;

import android.content.Context;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;

import androidx.recyclerview.widget.RecyclerView;

import com.me.matrixchat.R;

public class CustomSearchView extends LinearLayout {
    private EditText editText;
    private ImageView searchIcon;
    private RecyclerView recyclerView;

    public CustomSearchView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    private void init(Context context) {
        LayoutInflater.from(context).inflate(R.layout.custom_search_list, this, true);

        // Find views inside custom_search.xml
        editText = findViewById(R.id.search_icon);
        searchIcon = findViewById(R.id.search_edit_text);
        recyclerView = findViewById(R.id.recycler);
    }

    // Method to get the entered text
    public String getSearchText() {
        return editText.getText().toString();
    }

    // Method to set the text
    public void setSearchText(String text) {
        editText.setText(text);
    }

    // Method to change the search icon dynamically
    public void setSearchIcon(int resId) {
        searchIcon.setImageResource(resId);
    }

    // Method to clear text
    public void clearSearch() {
        editText.setText("");
    }

    public RecyclerView getRecycler() {
        return recyclerView;
    }

}
