// فحص تجميع ورسم واجهة تطبيق الكابتن بدون Android SDK:
// يجمّع نفس ملفات data/ و ui/ من تطبيق أندرويد على JVM باستخدام Compose Multiplatform 1.7.3
// (المقابل لـ Compose 1.7 في التطبيق)، مع بديل بسيط لملفات ui/platform الخاصة بأندرويد.
// ثم يرسم الشاشات إلى صور PNG ببيانات حيّة من خادم RMS.
//   التشغيل: (1) شغّل الخادم بعد npm run seed   (2) gradle run   → الصور في build/screens
plugins {
    kotlin("jvm") version "2.1.0"
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0"
    id("org.jetbrains.compose") version "1.7.3"
    application
}

dependencies {
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.materialIconsExtended)
    implementation(compose.animation)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.9.0")
    implementation("org.json:json:20240303")
}

kotlin { jvmToolchain(21) }

sourceSets.main {
    kotlin.srcDirs(
        "src/main/kotlin",
        "../app/src/main/java/com/example/rms/data",
        "../app/src/main/java/com/example/rms/ui",
    )
    kotlin.exclude("**/PrefsSessionStore.kt", "**/components/ImageLoader.kt", "**/components/StarlightLogo.kt")
}

application { mainClass.set("RenderKt") }

// حزم androidx.lifecycle لسطح المكتب منشورة في مستودع Google (غير متاح هنا) ولا يحتاجها الرسم دون نافذة
configurations.named("runtimeClasspath") {
    exclude(group = "androidx.lifecycle")
    exclude(group = "androidx.arch.core")
    exclude(group = "androidx.annotation")
    exclude(group = "androidx.collection")
}
// androidx.collection مبنية محليًا من مصدرها الرسمي (انظر README في هذا المجلد) وتوضع في libs/
dependencies { runtimeOnly(fileTree("libs") { include("*.jar") }) }
