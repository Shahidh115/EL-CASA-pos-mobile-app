package com.elcasa.roms.pos;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(context.getPackageName(), 0);

            JSObject ret = new JSObject();
            ret.put("packageName", context.getPackageName());
            ret.put("versionName", pInfo.versionName != null ? pInfo.versionName : "1.0.0");
            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = pInfo.getLongVersionCode();
            } else {
                versionCode = pInfo.versionCode;
            }
            ret.put("versionCode", versionCode);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get app version info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
            ret.put("canInstall", canInstall);
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open unknown app sources settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("filePath parameter is required");
            return;
        }

        try {
            if (filePath.startsWith("file://")) {
                filePath = Uri.parse(filePath).getPath();
            }
            File apkFile = new File(filePath);
            if (!apkFile.exists()) {
                call.reject("APK file does not exist at path: " + filePath);
                return;
            }

            triggerInstallIntent(apkFile);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filePath", apkFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to trigger package installer: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("Download URL is required");
            return;
        }

        String fileName = call.getString("fileName");
        if (fileName == null || fileName.trim().isEmpty()) {
            fileName = "elcasa_pos_update.apk";
        }

        final String finalFileName = fileName;

        // Perform download asynchronously in background thread
        new Thread(() -> {
            File targetFile = null;
            InputStream input = null;
            FileOutputStream output = null;
            HttpURLConnection connection = null;

            try {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir();
                if (cacheDir == null) {
                    cacheDir = context.getCacheDir();
                }

                targetFile = new File(cacheDir, finalFileName);
                if (targetFile.exists()) {
                    targetFile.delete();
                }

                URL url = new URL(downloadUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "ELCASA-ROMS-Android-Updater");

                int responseCode = connection.getResponseCode();
                // Handle manual redirects if necessary
                if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || 
                    responseCode == HttpURLConnection.HTTP_MOVED_TEMP || 
                    responseCode == 307 || responseCode == 308) {
                    String newUrl = connection.getHeaderField("Location");
                    connection.disconnect();
                    url = new URL(newUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(30000);
                    connection.setReadTimeout(60000);
                    connection.setRequestProperty("User-Agent", "ELCASA-ROMS-Android-Updater");
                    responseCode = connection.getResponseCode();
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    call.reject("Download server returned HTTP " + responseCode);
                    return;
                }

                int fileLength = connection.getContentLength();
                input = new BufferedInputStream(connection.getInputStream());
                output = new FileOutputStream(targetFile);

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastProgressTime = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);

                    long currentTime = System.currentTimeMillis();
                    // Throttle event notifications to every 250ms to avoid flooding JS bridge
                    if (currentTime - lastProgressTime > 250 || (fileLength > 0 && total >= fileLength)) {
                        lastProgressTime = currentTime;
                        JSObject progress = new JSObject();
                        int percent = fileLength > 0 ? (int) ((total * 100) / fileLength) : 0;
                        progress.put("percent", percent);
                        progress.put("bytesDownloaded", total);
                        progress.put("totalBytes", fileLength);
                        notifyListeners("downloadProgress", progress);
                    }
                }

                output.flush();

                // Trigger Android Install Intent
                triggerInstallIntent(targetFile);

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("filePath", targetFile.getAbsolutePath());
                call.resolve(result);

            } catch (Exception e) {
                if (targetFile != null && targetFile.exists()) {
                    targetFile.delete();
                }
                call.reject("Download or installation failed: " + e.getMessage(), e);
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                    if (connection != null) connection.disconnect();
                } catch (Exception ignored) {}
            }
        }).start();
    }

    private void triggerInstallIntent(File apkFile) {
        Context context = getContext();
        Uri apkUri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );
        } else {
            apkUri = Uri.fromFile(apkFile);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
