package androidx.lifecycle

class ViewModelProvider {
    interface Factory {
        fun <T : ViewModel> create(modelClass: Class<T>): T
    }
}
