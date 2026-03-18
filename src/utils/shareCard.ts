import {captureRef} from 'react-native-view-shot';
import Share from 'react-native-share';
import type {RefObject} from 'react';

/**
 * Captures the view referenced by `ref` as a PNG, then opens the native
 * share sheet with the image as an attachment.
 */
export async function shareCardImage(ref: RefObject<any>): Promise<void> {
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  // react-native-share needs a file:// URI on Android
  const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;

  await Share.open({
    url: fileUri,
    type: 'image/png',
    title: 'Share Collision Card',
    failOnCancel: false,
  });
}
