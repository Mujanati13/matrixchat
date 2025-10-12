package com.me.matrixchat.KeySpec

import org.matrix.android.sdk.api.session.securestorage.SsssKeySpec
import org.matrix.android.sdk.api.session.securestorage.SsssPassphrase

data class MyPassphraseKeySpec(
    val passphrase: String,
    val passphraseParams: SsssPassphrase
) : SsssKeySpec
