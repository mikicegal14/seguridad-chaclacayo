# Add project specific ProGuard rules here.
# By default, the active-set of rules will be merged with the system rules.
# For more details, see
#   http://developer.android.com/tools/help/proguard.html

# Keep Socket.IO classes
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Keep OkHttp & Retrofit classes
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**

# Gson rules
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
