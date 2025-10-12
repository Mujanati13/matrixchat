package com.me.matrixchat.Views;
import com.me.matrixchat.R;
import com.stfalcon.chatkit.messages.MessageInput;

import android.annotation.SuppressLint;
import android.content.Context;
import android.util.AttributeSet;

public class MessageInputView  extends MessageInput {


    public MessageInputView(Context context) {
        super(context);
        initChild(context);
    }

    public MessageInputView(Context context, AttributeSet attrs) {
        super(context, attrs);
        initChild(context);
    }

    public MessageInputView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        initChild(context);

    }



    private void initChild(Context context) {
        removeAllViews();
        removeAllViewsInLayout();
        inflate(context, R.layout.view_message_input, this);

        messageInput = findViewById(R.id.messageInput);
        messageSendButton = findViewById(R.id.messageSendButton);
        attachmentButton = findViewById(R.id.attachmentButton);

        messageSendButton.setOnClickListener(this);
        attachmentButton.setOnClickListener(this);
        messageInput.addTextChangedListener(this);
        messageInput.setText("");
        messageInput.setOnFocusChangeListener(this);
    }

    public void setOnclickListenerForAttachmentButton(OnClickListener listener){
        attachmentButton.setOnClickListener(listener);
    }
}
