package com.me.matrixchat;

import org.matrix.android.sdk.api.session.Session;

public class SessionHolder {

    public static Session currentSession;

    public static Session getCurrentSession() {
        return currentSession;
    }

    public static void setCurrentSession(Session session) {
        currentSession = session;
    }
}
