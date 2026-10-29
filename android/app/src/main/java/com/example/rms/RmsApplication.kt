package com.example.rms

import android.app.Application
import com.example.rms.data.remote.ApiClient
import com.example.rms.data.remote.PrefsSessionStore
import com.example.rms.data.repository.CaptainRepository

class RmsApplication : Application() {
    val repository by lazy {
        val session = PrefsSessionStore(this)
        CaptainRepository(ApiClient(session), session)
    }
}
