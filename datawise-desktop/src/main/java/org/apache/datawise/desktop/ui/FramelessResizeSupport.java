package org.apache.datawise.desktop.ui;

import org.cef.browser.CefBrowser;

import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;

/**
 * Installs CEF in a normal {@link BorderLayout} (never 0×0 absolute bounds — that blanks JCEF)
 * and attaches thin opaque-false edge strips for frameless resize.
 */
public final class FramelessResizeSupport {
    private static final int BORDER = 5;

    private FramelessResizeSupport() {
    }

    public static void install(JFrame frame, JComponent cefUi, CefBrowser browser) {
        JPanel root = new JPanel(new BorderLayout());
        root.setOpaque(true);
        root.setBackground(new java.awt.Color(0xF8, 0xFA, 0xFC));
        root.add(cefUi, BorderLayout.CENTER);
        root.add(strip(frame, 1), BorderLayout.NORTH);
        root.add(strip(frame, 2), BorderLayout.SOUTH);
        root.add(strip(frame, 4), BorderLayout.WEST);
        root.add(strip(frame, 8), BorderLayout.EAST);
        frame.setContentPane(root);
    }

    public static void notifyBrowserResized(CefBrowser browser, JFrame frame) {
        if (browser == null) {
            return;
        }
        JComponent ui = (JComponent) browser.getUIComponent();
        ui.invalidate();
        ui.revalidate();
        ui.repaint();
        if (frame != null && frame.getContentPane() != null) {
            frame.getContentPane().revalidate();
            frame.getContentPane().repaint();
        }
    }

    private static JPanel strip(JFrame frame, int edge) {
        JPanel panel = new JPanel();
        panel.setOpaque(false);
        if (edge == 1 || edge == 2) {
            panel.setPreferredSize(new Dimension(0, BORDER));
        } else {
            panel.setPreferredSize(new Dimension(BORDER, 0));
        }
        final Point[] dragStart = {null};
        final Rectangle[] startBounds = {null};

        panel.addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (!javax.swing.SwingUtilities.isLeftMouseButton(e) || isWorkAreaFilled(frame)) {
                    return;
                }
                dragStart[0] = e.getLocationOnScreen();
                startBounds[0] = frame.getBounds();
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                dragStart[0] = null;
                startBounds[0] = null;
            }

            @Override
            public void mouseEntered(MouseEvent e) {
                panel.setCursor(cursorFor(edge));
            }

            @Override
            public void mouseExited(MouseEvent e) {
                panel.setCursor(Cursor.getDefaultCursor());
            }
        });
        panel.addMouseMotionListener(new MouseMotionAdapter() {
            @Override
            public void mouseDragged(MouseEvent e) {
                if (dragStart[0] == null || startBounds[0] == null) {
                    return;
                }
                Point now = e.getLocationOnScreen();
                int dx = now.x - dragStart[0].x;
                int dy = now.y - dragStart[0].y;
                Rectangle b = new Rectangle(startBounds[0]);
                int minW = Math.max(frame.getMinimumSize().width, 800);
                int minH = Math.max(frame.getMinimumSize().height, 600);
                if (edge == 8) {
                    b.width = Math.max(minW, startBounds[0].width + dx);
                } else if (edge == 2) {
                    b.height = Math.max(minH, startBounds[0].height + dy);
                } else if (edge == 4) {
                    int newW = Math.max(minW, startBounds[0].width - dx);
                    b.x = startBounds[0].x + (startBounds[0].width - newW);
                    b.width = newW;
                } else if (edge == 1) {
                    int newH = Math.max(minH, startBounds[0].height - dy);
                    b.y = startBounds[0].y + (startBounds[0].height - newH);
                    b.height = newH;
                }
                frame.setBounds(b);
            }
        });
        return panel;
    }

    private static boolean isWorkAreaFilled(JFrame frame) {
        Rectangle work = WindowChromeController.workArea(frame);
        Rectangle b = frame.getBounds();
        return Math.abs(b.width - work.width) < 8 && Math.abs(b.height - work.height) < 8
                && Math.abs(b.x - work.x) < 8 && Math.abs(b.y - work.y) < 8;
    }

    private static Cursor cursorFor(int edge) {
        return switch (edge) {
            case 1 -> Cursor.getPredefinedCursor(Cursor.N_RESIZE_CURSOR);
            case 2 -> Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR);
            case 4 -> Cursor.getPredefinedCursor(Cursor.W_RESIZE_CURSOR);
            case 8 -> Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR);
            default -> Cursor.getDefaultCursor();
        };
    }
}
