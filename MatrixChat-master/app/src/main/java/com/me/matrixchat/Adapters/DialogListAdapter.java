package com.me.matrixchat.Adapters;



import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.core.content.ContextCompat;

import com.me.matrixchat.R;
import com.stfalcon.chatkit.commons.ImageLoader;
import com.stfalcon.chatkit.commons.Style;
import com.stfalcon.chatkit.commons.models.IDialog;
import com.stfalcon.chatkit.dialogs.DialogsListAdapter;

import org.matrix.android.sdk.api.session.user.model.User;
import org.matrix.android.sdk.api.util.MatrixItem;

public class DialogListAdapter<DIALOG extends IDialog>
        extends DialogsListAdapter<DIALOG> {
    public DialogListAdapter(ImageLoader imageLoader) {
        this(R.layout.item_room_summary, DialogViewHolder.class, imageLoader);
    }

    public DialogListAdapter(int itemLayoutId, ImageLoader imageLoader) {
        super(itemLayoutId, imageLoader);
    }

    public DialogListAdapter(int itemLayoutId, Class holderClass, ImageLoader imageLoader) {
        super(itemLayoutId, holderClass, imageLoader);
    }


    public static class DialogViewHolder<DIALOG extends IDialog> extends DialogsListAdapter.DialogViewHolder<DIALOG> {

        public DialogViewHolder(View itemView) {
            super(itemView);
            setDialogStyle(null);
        }

        @Override
        public void onBind(final DIALOG dialog) {
            // Call the superclass implementation to retain default behavior
            super.onBind(dialog);

            tvName.setTextColor(ContextCompat.getColor(tvName.getContext(), R.color.navy_blue));
            tvName.setText(toSentenceCase(dialog.getDialogName()));

            tvLastMessage.setTextColor(ContextCompat.getColor(tvName.getContext(), R.color.grey));



            //Set Dialog avatar
            if (super.imageLoader != null) {

                super.imageLoader.loadImage(super.ivAvatar, dialog.getDialogPhoto(), dialog.getDialogName());
            }

            //Set Last message user avatar with check if there is last message
            if (super.imageLoader != null && dialog.getLastMessage() != null) {

                super.imageLoader.loadImage(super.ivLastMessageUser, dialog.getLastMessage().getUser().getAvatar(), dialog.getLastMessage().getUser().getName());
            }
        }

        private String toSentenceCase(String string) {
            if (string == null || string.isEmpty()) {
                return string;
            }
            string = string.toLowerCase(); // Convert the whole string to lowercase
            return Character.toUpperCase(string.charAt(0)) + string.substring(1);
        }




    }


}
