package com.example.rms.data.remote

import com.example.rms.data.model.optNullableString
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val status: Int, val code: String?, message: String) : Exception(message) {
    val isUnauthorized get() = status == 401
    val mustChangePassword get() = code == "must_change_password"
}

class ApiClient(private val session: SessionStore) {

    suspend fun getArray(path: String, query: Map<String, String?> = emptyMap()): JSONArray =
        request("GET", path + buildQuery(query), null) as? JSONArray ?: JSONArray()

    suspend fun getObject(path: String, query: Map<String, String?> = emptyMap()): JSONObject =
        request("GET", path + buildQuery(query), null) as? JSONObject ?: JSONObject()

    suspend fun post(path: String, body: JSONObject = JSONObject()): JSONObject =
        request("POST", path, body) as? JSONObject ?: JSONObject()

    private suspend fun request(method: String, path: String, body: JSONObject?): Any? = withContext(Dispatchers.IO) {
        val connection = try {
            (URL("${session.baseUrl}/api$path").openConnection() as HttpURLConnection)
        } catch (e: Exception) {
            throw ApiException(0, "bad_url", "عنوان الخادم غير صالح")
        }
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            session.token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val parsed = if (text.isBlank()) null else runCatching { JSONTokener(text).nextValue() }.getOrNull()

            if (status !in 200..299) {
                val obj = parsed as? JSONObject
                val message = obj?.optNullableString("message")
                    ?: obj?.optJSONArray("errors")?.optJSONObject(0)?.optNullableString("msg")
                    ?: "خطأ من الخادم ($status)"
                throw ApiException(status, obj?.optNullableString("code"), message)
            }
            parsed
        } catch (e: IOException) {
            throw ApiException(0, "network", "تعذّر الاتصال بالخادم. تحقق من العنوان والاتصال بالشبكة")
        } finally {
            connection.disconnect()
        }
    }

    private fun buildQuery(query: Map<String, String?>): String {
        val parts = query.filterValues { !it.isNullOrEmpty() }
            .map { (k, v) -> "$k=${URLEncoder.encode(v, "UTF-8")}" }
        return if (parts.isEmpty()) "" else "?" + parts.joinToString("&")
    }
}
