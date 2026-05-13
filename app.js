import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// 1. Firebase Configuration (Get this from your Firebase Console)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const countdownList = document.getElementById('countdown-list');
    
    // 2. Initialize FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [] // Will be populated by Firebase
    });
    calendar.render();

    // 3. Real-Time Multi-User Listener
    // This instantly updates everyone's screen when an event is added/changed
    onSnapshot(collection(db, "events"), (snapshot) => {
        calendar.removeAllEvents();
        countdownList.innerHTML = ''; 

        const now = new Date().getTime();

        snapshot.forEach((doc) => {
            const eventData = doc.data();
            
            // Map labels to color codes
            let eventColor = '#3788d8'; // Default blue
            if (eventData.label === 'Work') eventColor = '#9933cc';
            if (eventData.label === 'Personal') eventColor = '#33cc33';

            // Add event to Calendar
            calendar.addEvent({
                id: doc.id,
                title: eventData.title,
                start: eventData.start,
                end: eventData.end,
                color: eventColor
            });

            // 4. Calculate Urgency and Countdown
            const eventTime = new Date(eventData.start).getTime();
            const timeLeft = eventTime - now;

            if (timeLeft > 0) {
                // Convert ms to hours and minutes
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                // Determine urgency color based on time left
                let urgencyClass = 'low-urgency';
                if (hours < 24) urgencyClass = 'medium-urgency';
                if (hours < 3) urgencyClass = 'high-urgency';

                // Update Sidebar
                countdownList.innerHTML += `
                    <div class="event-card ${urgencyClass}">
                        <strong>${eventData.title}</strong><br>
                        Starts in: ${hours}h ${minutes}m
                    </div>
                `;
            }
        });
    });
});
