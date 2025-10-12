package com.me.matrixchat.Views;

import android.content.Context;
import android.util.AttributeSet;

import androidx.annotation.Nullable;

import com.stfalcon.chatkit.messages.MessagesList;

public class MessageListView extends MessagesList {
    public MessageListView(Context context) {
        super(context);
    }

    public MessageListView(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
    }

    public MessageListView(Context context, @Nullable AttributeSet attrs, int defStyle) {
        super(context, attrs, defStyle);
    }
}
