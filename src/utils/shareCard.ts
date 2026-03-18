import {captureRef} from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type {RefObject} from 'react';

/**
 * Captures the view referenced by `ref` as a PNG, then opens the native
 * share sheet with the image as an attachment via expo-sharing.
 */
export async function shareCardImage(ref: RefObject<any>): Promise<void> {
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  // Skip isAvailableAsync() — it can return false on Android bare workflow
  // even when sharing is fully functional. Just call shareAsync directly.
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share Collision Card',
  });
}
