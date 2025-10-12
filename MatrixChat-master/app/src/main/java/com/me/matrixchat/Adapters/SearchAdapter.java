package com.me.matrixchat.Adapters;

import static androidx.core.content.ContextCompat.getSystemService;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.recyclerview.widget.RecyclerView;

import com.me.matrixchat.R;
import com.me.matrixchat.Views.SearchItem;

import java.util.List;

public class SearchAdapter extends RecyclerView.Adapter<SearchAdapter.ViewHolder> {
    private List<SearchItem> itemList;
    private Context context;

    public SearchAdapter(List<SearchItem> itemList, Context context) {
        this.itemList = itemList;
        this.context = context;
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        public ImageView profileImage;
        public TextView userName;
        public TextView messageTime;
        public ImageView copy;

        public ViewHolder(View itemView) {
            super(itemView);
            profileImage = itemView.findViewById(R.id.profile_image);
            userName = itemView.findViewById(R.id.user_name);
            messageTime = itemView.findViewById(R.id.message_time);
            copy = itemView.findViewById(R.id.copy);
        }
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        // Inflate the layout for an individual search item
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.custom_search_list_item, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(ViewHolder holder, int position) {
        SearchItem item = itemList.get(position);
        holder.userName.setText(toSentenceCase(item.getName()));
        holder.messageTime.setText(item.getTime());
        holder.copy.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                copySeedPhraseToClipboard(item.getTime(), "User's matrix Id");
            }
        });
        // You can also load the profile image if available
    }

    @Override
    public int getItemCount() {
        return itemList.size();
    }

    private String toSentenceCase(String string) {
        if (string == null || string.isEmpty()) {
            return string;
        }
        string = string.toLowerCase(); // Convert the whole string to lowercase
        return Character.toUpperCase(string.charAt(0)) + string.substring(1);
    }

    private void copySeedPhraseToClipboard(String text, String title) {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText(title, text);
        if (clipboard != null) {
            clipboard.setPrimaryClip(clip);
            // Optionally, show a toast to notify the user.
            Toast.makeText(context, title + " copied!", Toast.LENGTH_SHORT).show();
        }
    }

}

