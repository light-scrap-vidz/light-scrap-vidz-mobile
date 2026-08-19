import * as Notifications from 'expo-notifications';

let configured = false;

function ensureHandler() {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  configured = true;
}

/** Best-effort local notification on download completion. Never throws. */
export async function notifyDownloadComplete(title: string): Promise<void> {
  try {
    ensureHandler();
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Download complete', body: title },
      trigger: null,
    });
  } catch {
    // notifications are not critical
  }
}
