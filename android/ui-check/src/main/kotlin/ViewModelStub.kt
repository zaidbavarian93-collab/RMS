package androidx.lifecycle

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.util.WeakHashMap

// بديل JVM مبسّط لـ androidx.lifecycle.ViewModel (المستودع الذي يوفّر نسخة سطح المكتب غير متاح هنا)
abstract class ViewModel {
    protected open fun onCleared() {}
}

private val scopes = WeakHashMap<ViewModel, CoroutineScope>()

val ViewModel.viewModelScope: CoroutineScope
    get() = synchronized(scopes) { scopes.getOrPut(this) { CoroutineScope(SupervisorJob() + Dispatchers.Main) } }
