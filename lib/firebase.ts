import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCePv2LwNA5ABNbXqXmnpRAJIvT5v0fKfI",
  authDomain: "crisis-coordinator.firebaseapp.com",
  projectId: "crisis-coordinator",
  storageBucket: "crisis-coordinator.firebasestorage.app",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getFirestore(app)