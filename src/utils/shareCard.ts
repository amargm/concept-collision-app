import {captureRef} from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type {RefObject} from 'react';

/**
 * Captures the view referenced by `ref` as a PNG, then opens the native
 * share sheet with the image as an attachment via expo-sharing.
 * Works correctly on both Android (intent + file URI) and iOS (UIActivityViewController).
 */
export async function shareCardImage(ref: RefObject<any>): Promise<void> {
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share Collision Card',
  });
}
