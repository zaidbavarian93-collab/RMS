// اختبار JVM لطبقة البيانات في تطبيق الكابتن (نفس الملفات المستخدمة في أندرويد) مقابل خادم RMS حقيقي.
// لا يحتاج Android SDK. التشغيل: (1) شغّل الخادم بعد npm run seed  (2) gradle run   [RMS_URL لتغيير العنوان]
plugins { kotlin("jvm") version "2.1.0"; application }
repositories { mavenCentral() }
dependencies {
    implementation("org.json:json:20240303")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
}
kotlin { jvmToolchain(21) }
sourceSets.main { kotlin.srcDirs("src/main/kotlin", "../app/src/main/java/com/example/rms/data"); kotlin.exclude("**/PrefsSessionStore.kt") }
application { mainClass.set("MainKt") }
