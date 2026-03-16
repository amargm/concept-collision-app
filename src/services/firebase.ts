import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// @react-native-firebase auto-initialises from google-services.json at native build time.
// No explicit initializeApp() call is needed in the bare RN Firebase SDK.

export { auth, firestore };
