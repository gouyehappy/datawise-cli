package org.apache.datawise.desktop.tray;

import org.apache.datawise.desktop.DesktopAppIcons;

import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import java.awt.AWTException;
import java.awt.Image;
import java.awt.MenuItem;
import java.awt.PopupMenu;
import java.awt.SystemTray;
import java.awt.TrayIcon;
import java.util.function.BooleanSupplier;

/**
 * System tray. AWT {@link PopupMenu} on Windows is ANSI/system-codepage — keep labels ASCII
 * to avoid mojibake; balloon tip also uses ASCII for the same reason.
 */
public final class SystemTrayService {
    private static final String NOTIFY_TITLE = "DataWise CLI";
    private static final String NOTIFY_BODY =
            "Still running in the background. Click the tray icon to restore, or right-click to quit.";

    private final JFrame mainFrame;
    private final BooleanSupplier isQuitting;
    private final Runnable onQuit;
    private TrayIcon trayIcon;
    private boolean closeToTray = true;

    public SystemTrayService(JFrame mainFrame, BooleanSupplier isQuitting, Runnable onQuit) {
        this.mainFrame = mainFrame;
        this.isQuitting = isQuitting;
        this.onQuit = onQuit;
    }

    public void install() {
        if (!SystemTray.isSupported()) {
            return;
        }
        try {
            PopupMenu menu = new PopupMenu();
            MenuItem show = new MenuItem("Open DataWise");
            show.addActionListener(e -> SwingUtilities.invokeLater(this::showMain));
            MenuItem quit = new MenuItem("Quit");
            quit.addActionListener(e -> {
                closeToTray = false;
                // Remove tray icon immediately — don't wait for backend/CEF teardown.
                dispose();
                try {
                    mainFrame.setVisible(false);
                } catch (Exception ignored) {
                }
                if (onQuit != null) {
                    // EDT for Swing hide/timer; shutdown itself kicks async process kill.
                    SwingUtilities.invokeLater(onQuit);
                } else {
                    mainFrame.dispose();
                    System.exit(0);
                }
            });
            menu.add(show);
            menu.addSeparator();
            menu.add(quit);

            Image image = DesktopAppIcons.trayIcon();
            trayIcon = new TrayIcon(image, "DataWise CLI", menu);
            trayIcon.setImageAutoSize(true);
            trayIcon.addActionListener(e -> SwingUtilities.invokeLater(this::showMain));
            SystemTray.getSystemTray().add(trayIcon);
        } catch (AWTException e) {
            System.err.println("[datawise-desktop] tray unavailable: " + e.getMessage());
        }
    }

    public boolean handleWindowClosing() {
        if (!closeToTray || isQuitting.getAsBoolean() || trayIcon == null) {
            return false;
        }
        hideToTray(true);
        return true;
    }

    public void hideToTray(boolean notify) {
        boolean wasVisible = mainFrame.isVisible();
        mainFrame.setVisible(false);
        if (notify && wasVisible && trayIcon != null) {
            try {
                trayIcon.displayMessage(NOTIFY_TITLE, NOTIFY_BODY, TrayIcon.MessageType.INFO);
            } catch (Exception e) {
                System.err.println("[datawise-desktop] tray notify failed: " + e.getMessage());
            }
        }
    }

    public void showMain() {
        mainFrame.setVisible(true);
        mainFrame.setExtendedState(mainFrame.getExtendedState() & ~JFrame.ICONIFIED);
        mainFrame.toFront();
        mainFrame.requestFocus();
    }

    public void dispose() {
        if (trayIcon != null && SystemTray.isSupported()) {
            SystemTray.getSystemTray().remove(trayIcon);
            trayIcon = null;
        }
    }
}
