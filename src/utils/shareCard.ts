import {Platform, Share} from 'react-native';
import {captureRef} from 'react-native-view-shot';
import type {RefObject} from 'react';

/**
 * Captures the view referenced by `ref` as a PNG, then opens the native
 * share sheet with the image URI as an attachment.
 *
 * On Android the URI is passed as `url`. On iOS it is in `url` too — both
 * platforms support image URIs from the app's temp directory this way.
 */
export async function shareCardImage(ref: RefObject<any>): Promise<void> {
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  if (Platform.OS === 'android') {
    await Share.share({url: uri, message: 'conceptcollision.app'});
  } else {
    await Share.share({url: uri});
  }
}
