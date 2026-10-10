package com.example.rms.data.remote

import android.content.Context
import com.example.rms.data.model.SessionUser
import com.example.rms.data.model.optNullableString
import com.example.rms.data.model.parseUser
import org.json.JSONObject

class PrefsSessionStore(context: Context) : SessionStore {
    private val prefs = context.getSharedPreferences("rms_session", Context.MODE_PRIVATE)

    override var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, SessionStore.DEFAULT_BASE_URL) ?: SessionStore.DEFAULT_BASE_URL
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trim().trimEnd('/')).apply()

    override var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    override var user: SessionUser?
        get() = prefs.getString(KEY_USER, null)?.let { runCatching { parseUser(JSONObject(it)) }.getOrNull() }
        set(value) = prefs.edit().putString(KEY_USER, value?.let { toJson(it).toString() }).apply()

    override fun clear() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
    }

    private fun toJson(u: SessionUser) = JSONObject()
        .put("id", u.id).put("full_name", u.fullName).put("username", u.username)
        .put("role", u.role).put("must_change_password", u.mustChangePassword)

    private companion object {
        const val KEY_BASE_URL = "base_url"
        const val KEY_TOKEN = "token"
        const val KEY_USER = "user"
    }
}
