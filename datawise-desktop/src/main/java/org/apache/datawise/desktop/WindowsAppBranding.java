package org.apache.datawise.desktop;

import com.sun.jna.Native;
import com.sun.jna.WString;
import com.sun.jna.platform.win32.Shell32;
import com.sun.jna.win32.StdCallLibrary;
import com.sun.jna.win32.W32APIOptions;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Windows branding helpers. Toast / Action Center headers follow the <b>process executable</b>
 * name unless an AppUserModelID + Start Menu shortcut is registered.
 */
public final class WindowsAppBranding {
    public static final String APP_USER_MODEL_ID = "org.apache.datawise.DataWiseCLI";
    public static final String DISPLAY_NAME = "DataWise CLI";

    private WindowsAppBranding() {
    }

    public static void applyIfWindows(Path installRoot, Path preferredLauncher) {
        if (!System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
            return;
        }
        try {
            try {
                Shell32.INSTANCE.SetCurrentProcessExplicitAppUserModelID(new WString(APP_USER_MODEL_ID));
            } catch (Throwable ignored) {
                Shell32Ex.INSTANCE.SetCurrentProcessExplicitAppUserModelID(new WString(APP_USER_MODEL_ID));
            }
        } catch (Throwable t) {
            System.err.println("[datawise-desktop] AppUserModelID skipped: " + t.getMessage());
        }
        try {
            ensureStartMenuShortcut(installRoot, preferredLauncher);
        } catch (Throwable t) {
            System.err.println("[datawise-desktop] Start Menu shortcut skipped: " + t.getMessage());
        }
    }

    private static void ensureStartMenuShortcut(Path installRoot, Path preferredLauncher) throws Exception {
        Path launcher = preferredLauncher;
        if (launcher == null || !Files.isRegularFile(launcher)) {
            Path exe = installRoot.resolve("DataWiseCLI.exe");
            Path cmd = installRoot.resolve("DataWiseCLI.cmd");
            launcher = Files.isRegularFile(exe) ? exe : (Files.isRegularFile(cmd) ? cmd : null);
        }
        if (launcher == null) {
            return;
        }

        Path programs = Path.of(System.getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs");
        Files.createDirectories(programs);
        Path shortcut = programs.resolve(DISPLAY_NAME + ".lnk");
        Path icon = installRoot.resolve("icons").resolve("icon.ico");

        Path script = DesktopPaths.userDataDir().resolve("ensure-shortcut.ps1");
        Files.createDirectories(script.getParent());
        String body = String.join("\n",
                "$ErrorActionPreference = 'Stop'",
                "$shortcutPath = '" + psEscape(shortcut.toAbsolutePath().toString()) + "'",
                "$targetPath = '" + psEscape(launcher.toAbsolutePath().toString()) + "'",
                "$workDir = '" + psEscape(installRoot.toAbsolutePath().toString()) + "'",
                "$iconPath = '" + psEscape(icon.toAbsolutePath().toString()) + "'",
                "$w = New-Object -ComObject WScript.Shell",
                "$s = $w.CreateShortcut($shortcutPath)",
                "$s.TargetPath = $targetPath",
                "$s.WorkingDirectory = $workDir",
                "$s.Description = 'DataWise CLI'",
                "if (Test-Path -LiteralPath $iconPath) { $s.IconLocation = \"$iconPath,0\" }",
                "$s.Save()",
                ""
        );
        Files.writeString(script, body, StandardCharsets.UTF_8);

        ProcessBuilder pb = new ProcessBuilder(
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", script.toAbsolutePath().toString());
        pb.redirectErrorStream(true);
        Process p = pb.start();
        p.waitFor(15, TimeUnit.SECONDS);
    }

    private static String psEscape(String value) {
        return value.replace("'", "''");
    }

    private interface Shell32Ex extends StdCallLibrary {
        Shell32Ex INSTANCE = Native.load("shell32", Shell32Ex.class, W32APIOptions.DEFAULT_OPTIONS);

        void SetCurrentProcessExplicitAppUserModelID(WString appID);
    }
}
