package com.example.rms

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.example.rms.ui.RmsApp
import com.example.rms.ui.theme.RmsTheme
import com.example.rms.ui.viewmodel.CaptainViewModel
import com.example.rms.ui.viewmodel.CaptainViewModelFactory
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val viewModel: CaptainViewModel by viewModels {
        CaptainViewModelFactory((application as RmsApplication).repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // تحديث حي للطاولات والطلب المفتوح كل 5 ثوانٍ، فقط طالما التطبيق ظاهر على الشاشة
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    viewModel.tick()
                    delay(POLL_INTERVAL_MS)
                }
            }
        }

        setContent {
            RmsTheme {
                RmsApp(viewModel = viewModel)
            }
        }
    }

    private companion object {
        const val POLL_INTERVAL_MS = 5_000L
    }
}
