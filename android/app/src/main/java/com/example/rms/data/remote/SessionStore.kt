package com.example.rms.data.remote

import com.example.rms.data.model.SessionUser

// واجهة تخزين الجلسة: التطبيق يستخدم SharedPreferences (PrefsSessionStore) والاختبارات تستخدم نسخة في الذاكرة
interface SessionStore {
    var baseUrl: String
    var token: String?
    var user: SessionUser?
    fun clear()

    companion object {
        // 10.0.2.2 هو عنوان جهاز الكمبيوتر من داخل محاكي أندرويد
        const val DEFAULT_BASE_URL = "http://10.0.2.2:4000"
    }
}

class MemorySessionStore(override var baseUrl: String = SessionStore.DEFAULT_BASE_URL) : SessionStore {
    override var token: String? = null
    override var user: SessionUser? = null
    override fun clear() { token = null; user = null }
}
