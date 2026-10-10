@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import com.example.rms.data.remote.ApiClient
import com.example.rms.data.remote.MemorySessionStore
import com.example.rms.data.repository.CaptainRepository
import com.example.rms.ui.RmsApp
import com.example.rms.ui.theme.RmsTheme
import com.example.rms.ui.viewmodel.CaptainViewModel
import kotlinx.coroutines.runBlocking
import org.jetbrains.skia.EncodedImageFormat
import java.io.File

// يرسم شاشات تطبيق الكابتن (نفس كود Compose في التطبيق) إلى صور PNG ببيانات حيّة من خادم RMS
val BASE: String = System.getenv("RMS_URL") ?: "http://127.0.0.1:4000"
const val W = 1080
const val H = 2340
val OUT = File("build/screens").apply { mkdirs() }
lateinit var scene: ImageComposeScene
val t0 = System.nanoTime()

fun settle(ms: Long) {
    val end = System.currentTimeMillis() + ms
    while (System.currentTimeMillis() < end) { scene.render(System.nanoTime() - t0); Thread.sleep(16) }
}

fun shot(name: String) {
    File(OUT, "$name.png").writeBytes(scene.render(System.nanoTime() - t0).encodeToData(EncodedImageFormat.PNG)!!.bytes)
    println("📸 $name")
}

fun waitFor(what: String, timeoutMs: Long = 8000, cond: () -> Boolean) {
    val end = System.currentTimeMillis() + timeoutMs
    while (!cond()) { check(System.currentTimeMillis() < end) { "timeout waiting for $what" }; settle(50) }
}

fun main() {
    val store = MemorySessionStore(BASE)
    val vm = CaptainViewModel(CaptainRepository(ApiClient(store), store))
    scene = ImageComposeScene(W, H, Density(2.75f)) { RmsTheme { RmsApp(vm) } }

    // شاشة الدخول تعرض اسم المطعم وشعاره من المسار العام
    waitFor("public brand") { vm.brand.value.name != null }
    settle(1500); shot("01-login-brand")
    vm.login(BASE, "captain1", "captain123")
    waitFor("login") { vm.user.value != null }
    settle(900); shot("02-change-password")
    vm.changePassword("captain123", "Cap!Strong-123", "Cap!Strong-123")
    waitFor("password") { vm.user.value?.mustChangePassword == false }

    runBlocking { vm.tick() }
    waitFor("branch brand") { vm.brand.value.logoUrl != null }
    settle(1500); shot("03-tables-brand")
    val t4 = vm.tableMap.value!!.tables.first { it.number == "4" }
    vm.openTable(t4.id); runBlocking { vm.tick() }
    settle(1200); shot("04-order")
    println("✅ done")
    scene.close()
    kotlin.system.exitProcess(0)
}
