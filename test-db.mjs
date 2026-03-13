import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBtLTZInxyKjbQCoSvqKOGDdOjhrOFfgaM",
    authDomain: "tgf-meditation.firebaseapp.com",
    projectId: "tgf-meditation"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const usersCount = (await getDocs(collection(db, 'users'))).size;
    console.log(`users count: ${usersCount}`);

    const userchallenges = await getDocs(collection(db, 'user_challenges'));
    console.log(`user_challenges count: ${userchallenges.size}`);
    userchallenges.forEach(d => console.log('user_challenge:', d.id, d.data()));

    const enrollments = await getDocs(collection(db, 'enrollments'));
    console.log(`enrollments count: ${enrollments.size}`);
    enrollments.forEach(d => console.log('enrollment:', d.id, d.data()));

    process.exit(0);
}

run();
