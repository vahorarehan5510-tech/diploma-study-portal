const firebaseConfig = {
    apiKey: "AIzaSyBi2WCy7rGfQ5Ie7ckR6SgeVPIsdPFWck8",
    authDomain: "diploma-study-portal.firebaseapp.com",
    databaseURL: "https://diploma-study-portal-default-rtdb.firebaseio.com/",
    projectId: "diploma-study-portal",
    storageBucket: "diploma-study-portal.firebasestorage.app",
    messagingSenderId: "233448737809",
    appId: "1:233448737809:web:8f34ab9caa3d0f521ab5b0"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const baseStaticBranches = ["Computer", "Chemical", "IT", "Civil", "Mechanical"];
let db = { branches: {}, pyqs: {} };
let currentOpenBranch, currentOpenSem, currentOpenSubject;
let tempGoogleUser = null; 
let currentActiveSection = 'subjects'; 
const MY_UPI_ID = "9016929061@fam"; 

window.onclick = function(event) {
    if (!event.target.closest('.notif-wrapper')) {
        document.getElementById('notif-dropdown').classList.remove('active');
    }
}

window.onload = function() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            tempGoogleUser = user;
            database.ref('registered_students/' + user.uid).on('value', (snapshot) => {
                if(snapshot.exists()) {
                    let studentData = snapshot.val();
                    if(!document.getElementById('gateway-screen').classList.contains('hidden') && document.getElementById('welcome-animation').classList.contains('hidden')) {
                        triggerWelcomeAnimation(studentData.name, studentData);
                    } else {
                        showHomePage(studentData);
                    }
                    setupLiveListeners(user);
                } else {
                    document.getElementById('login-form').classList.add('hidden');
                    document.getElementById('home-page').classList.add('hidden');
                    document.getElementById('wizard-form').classList.remove('hidden');
                }
            });
        } else {
            tempGoogleUser = null;
            document.getElementById('home-page').classList.add('hidden');
            document.getElementById('wizard-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('gateway-screen').classList.remove('hidden');
        }
    });

    database.ref('portal_db').on('value', (snapshot) => {
        if(snapshot.exists()) {
            db = snapshot.val();
            if(!db.branches) db.branches = {};
            if(!db.pyqs) db.pyqs = {};
            baseStaticBranches.forEach(b => { if(!db.branches[b]) db.branches[b] = {}; });
        }
        populateDropdowns();
        calculateLiveCounters();
    });
    populateDropdowns();
};

// --- NAVIGATION LAYOUT UTILS ---
function toggleDashboardUI(show) {
    const dashCard = document.querySelector('.user-dashboard-card');
    const searchBar = document.querySelector('.search-container');
    if(dashCard && searchBar) {
        if(show) {
            dashCard.classList.remove('hidden');
            searchBar.classList.remove('hidden');
        } else {
            dashCard.classList.add('hidden');
            searchBar.classList.add('hidden');
        }
    }
}

function processGoogleLogin() {
    firebase.auth().signInWithPopup(googleProvider).catch((error) => {
        firebase.auth().signInWithRedirect(googleProvider);
    });
}

function saveRegistration() {
    if(!tempGoogleUser) return;
    let user = {
        uid: tempGoogleUser.uid,
        email: tempGoogleUser.email,
        name: tempGoogleUser.displayName || "Student",
        photo: tempGoogleUser.photoURL || "",
        college: document.getElementById('reg-college').value,
        dob: document.getElementById('reg-dob').value,
        enroll: document.getElementById('reg-enroll').value,
        batch: document.getElementById('reg-batch').value,
        branch: document.getElementById('reg-branch-select').value, 
        sem: document.getElementById('reg-sem').value,
        progress: { videos: 0, pdfs: 0, pyqs: 0 },
        unlocked_subjects: {}
    };
    database.ref('registered_students/' + user.uid).set(user);
}

function filterCards() {
    let filter = document.getElementById('search-input').value.toLowerCase();
    let visibleContainer = document.querySelector('.grid-container:not(.hidden)');
    if(!visibleContainer) return;
    let cards = visibleContainer.querySelectorAll('.box-card');
    cards.forEach(card => {
        let text = card.innerText.toLowerCase();
        if(text.includes(filter)) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
}

function setupLiveListeners(user) {
    database.ref('notifications').limitToLast(10).on('value', snap => {
        let listContainer = document.getElementById('notif-list-container');
        let badge = document.getElementById('notif-badge');
        if(!listContainer || !badge) return;
        listContainer.innerHTML = '';
        if(snap.exists()) {
            let notifs = [];
            snap.forEach(child => { notifs.push(child.val()); });
            notifs.reverse();
            badge.innerText = notifs.length;
            badge.classList.remove('hidden');
            notifs.forEach(n => {
                let div = document.createElement('div');
                div.className = 'notif-item';
                div.innerHTML = `<strong>Admin:</strong> ${n.text} <span class="notif-time">${new Date(n.time).toLocaleDateString()}</span>`;
                listContainer.appendChild(div);
            });
        } else {
            badge.classList.add('hidden');
            listContainer.innerHTML = `<div style="padding: 15px; text-align: center; color: var(--text-light); font-size: 12px;">No new notifications</div>`;
        }
    });

    database.ref('registered_students/' + user.uid + '/progress').on('value', snap => {
        let p = snap.val() || { videos: 0, pdfs: 0, pyqs: 0 };
        const vEl = document.getElementById('prog-videos');
        const pEl = document.getElementById('prog-pdfs');
        const pyEl = document.getElementById('prog-pyqs');
        const barFill = document.getElementById('prog-bar-fill');
        
        if(vEl) vEl.innerText = `📺 Watched: ${p.videos || 0}`;
        if(pEl) pEl.innerText = `📄 Read: ${p.pdfs || 0}`;
        if(pyEl) pyEl.innerText = `📜 PYQs: ${p.pyqs || 0}`;
        
        let total = (p.videos || 0) + (p.pdfs || 0) + (p.pyqs || 0);
        let percent = Math.min((total / 30) * 100, 100);
        if(barFill) barFill.style.width = percent + '%';
    });
}

function trackProgress(type) {
    if(!tempGoogleUser) return;
    let ref = database.ref('registered_students/' + tempGoogleUser.uid + '/progress');
    ref.transaction(prog => {
        if(!prog) prog = { videos: 0, pdfs: 0, pyqs: 0 };
        if(type === 'video') prog.videos = (prog.videos || 0) + 1;
        if(type === 'pdf') prog.pdfs = (prog.pdfs || 0) + 1;
        if(type === 'pyq') prog.pyqs = (prog.pyqs || 0) + 1;
        return prog;
    });
}

function toggleNotifs(e) {
    if(e) e.stopPropagation();
    document.getElementById('notif-dropdown').classList.toggle('active');
    document.getElementById('notif-badge').classList.add('hidden');
}

function showSection(sectionType) {
    toggleSidebar();
    currentActiveSection = sectionType;
    document.getElementById('search-input').value = "";
    let chContainer = document.getElementById('chapters-container');
    let matContainer = document.getElementById('materials-container');
    let backBtn = document.getElementById('btn-back');
    chContainer.classList.add('hidden'); matContainer.classList.add('hidden'); backBtn.classList.add('hidden');
    
    if(sectionType === 'subjects') {
        document.getElementById('pyqs-container').classList.add('hidden');
        renderSubjects();
    } else if (sectionType === 'pyqs') {
        document.getElementById('subjects-container').classList.add('hidden');
        renderPYQSubjects();
    }
}

function openForumModal() {
    toggleSidebar();
    let modal = document.getElementById('info-modal');
    let title = document.getElementById('modal-title');
    let body = document.getElementById('modal-body-text');
    let footer = document.getElementById('modal-footer-buttons');

    title.innerText = "💬 Global Discussion Forum";
    body.innerHTML = `
        <div class="forum-container">
            <div id="forum-chat-box" class="forum-messages">
                <div style="text-align:center; color:var(--text-light); font-size:12px; margin-top:20px;">Loading messages...</div>
            </div>
            <div class="forum-input-group">
                <input type="text" id="forum-input-msg" placeholder="Type your doubt or reply..." onkeypress="if(event.key === 'Enter') sendForumMsg()">
                <button class="btn-send" onclick="sendForumMsg()">➤</button>
            </div>
        </div>
    `;
    footer.innerHTML = `<button class="btn-close-modal" onclick="closeModal()">Close Panel</button>`;
    modal.classList.add('active');

    let chatBox = document.getElementById('forum-chat-box');
    database.ref('forum').limitToLast(50).on('value', snap => {
        if(!document.getElementById('forum-chat-box')) return;
        chatBox.innerHTML = '';
        if(snap.exists()) {
            snap.forEach(child => {
                let msg = child.val();
                let isMine = tempGoogleUser && msg.uid === tempGoogleUser.uid;
                let div = document.createElement('div');
                div.className = `forum-msg ${isMine ? 'mine' : ''}`;
                div.innerHTML = `<strong>${msg.name}</strong>${msg.text}<span class="time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
                chatBox.appendChild(div);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        } else {
            chatBox.innerHTML = '<div style="text-align:center; color:var(--text-light); font-size:12px; margin-top:20px;">Be the first to start a discussion!</div>';
        }
    });
}

function sendForumMsg() {
    let input = document.getElementById('forum-input-msg');
    let text = input.value.trim();
    if(!text || !tempGoogleUser) return;
    
    database.ref('registered_students/' + tempGoogleUser.uid).once('value').then(snap => {
        let uName = snap.exists() ? snap.val().name : "Student";
        database.ref('forum').push({
            uid: tempGoogleUser.uid,
            name: uName,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        input.value = "";
    });
}

function triggerWelcomeAnimation(name, userData) {
    document.getElementById('gateway-screen').classList.add('hidden');
    let animScreen = document.getElementById('welcome-animation');
    animScreen.classList.remove('hidden'); animScreen.innerText = `Welcome, ${name}!`;
    setTimeout(() => { animScreen.classList.add('hidden'); showHomePage(userData); }, 2000);
}

function showHomePage(user) {
    document.getElementById('gateway-screen').classList.add('hidden');
    document.getElementById('home-page').classList.remove('hidden');
    
    document.getElementById('user-profile-name').innerText = user.name;
    document.getElementById('user-profile-enroll').innerText = `Enrollment: ${user.enroll}`;
    document.getElementById('dash-welcome-title').innerText = `Hello, ${user.name}! 👋`;
    document.getElementById('dash-stat-batch').innerHTML = `<b>Batch:</b> ${user.batch}`;
    document.getElementById('dash-stat-college').innerHTML = `<b>College:</b> ${user.college}`;
    document.getElementById('filter-subheading').innerText = `Branch: ${user.branch} Eng. | Semester: ${user.sem}`;
    
    loadUserProfilePhoto(user);
    renderSubjects();
}

function renderSubjects() {
    toggleDashboardUI(true); // મુખ્ય લિસ્ટ પર ડેશબોર્ડ બતાવો
    let container = document.getElementById('subjects-container');
    let chContainer = document.getElementById('chapters-container');
    let pyqListContainer = document.getElementById('pyqs-container');
    let backBtn = document.getElementById('btn-back');

    container.classList.remove('hidden');
    chContainer.classList.add('hidden');
    pyqListContainer.classList.add('hidden');
    backBtn.classList.add('hidden');

    document.getElementById('filter-heading').innerText = "Your Subjects"; 
    container.innerHTML = `<div class="box-card loading-skeleton"></div><div class="box-card loading-skeleton"></div>`;

    database.ref('registered_students/' + tempGoogleUser.uid).once('value').then((snapshot) => {
        let user = snapshot.val();
        container.innerHTML = "";

        let branchData = (db.branches && db.branches[user.branch]) || {}; 
        let semData = branchData[user.sem] || {}; 
        let subjects = Object.keys(semData);

        if(subjects.length === 0) {
            container.innerHTML = "<p style='padding:15px; color:var(--text-light);'>No subjects uploaded yet.</p>"; return;
        }
        subjects.forEach(sub => {
            let subObj = semData[sub];
            let price = (subObj && typeof subObj === 'object' && subObj.price) ? parseInt(subObj.price) : 0;
            let card = document.createElement('div'); 
            card.className = "box-card"; 
            let isUnlocked = user.unlocked_subjects && user.unlocked_subjects[sub];
            
            if(price > 0 && isUnlocked !== "approved") {
                if(isUnlocked === "pending") {
                    card.innerHTML = `📘 ${sub} <span class="price-badge" style="background:#fef3c7; color:#d97706;">⏳ Pending Approval</span>`;
                } else {
                    card.innerHTML = `📘 ${sub} <span class="price-badge">🔒 Premium - ₹${price}</span>`;
                }
            } else {
                card.innerHTML = `📘 ${sub}`;
            }

            card.onclick = () => { 
                document.getElementById('search-input').value = ""; 
                handleSubjectAccess(user, user.branch, user.sem, sub, price);
            };
            container.appendChild(card);
        });
    }).catch(() => {
        container.innerHTML = "<p style='padding:15px; color:#ef4444;'>Error loading dataset mapping structures.</p>";
    });
}

function handleSubjectAccess(user, branch, sem, subject, price) {
    let status = user.unlocked_subjects ? user.unlocked_subjects[subject] : null;
    if(price > 0 && status !== "approved") {
        if(status === "pending") {
            alert("તમારા પેમેન્ટનું વેરિફિકેશન ચાલુ છે. એડમિન ટૂંક સમયમાં અપ્રુવ કરશે. ⏳");
        } else {
            openPaymentModal(user, branch, sem, subject, price);
        }
    } else {
        openSubjectHub(branch, sem, subject);
    }
}

// ૧. સબ્જેક્ટ હબ (નવું ક્લીન પેજ - ડેશબોર્ડ હાઇડ થઈ જશે)
function openSubjectHub(branch, sem, subject) {
    currentOpenBranch = branch; currentOpenSem = sem; currentOpenSubject = subject;
    toggleDashboardUI(false); // ડેશબોર્ડની બધી વિગતો ગાયબ કરો

    let container = document.getElementById('subjects-container'); 
    let chContainer = document.getElementById('chapters-container'); 
    let pyqListContainer = document.getElementById('pyqs-container');
    let backBtn = document.getElementById('btn-back');

    container.classList.add('hidden'); 
    pyqListContainer.classList.add('hidden');
    chContainer.classList.remove('hidden'); 
    backBtn.classList.remove('hidden');
    
    document.getElementById('filter-heading').innerText = `✨ ${subject}`; 
    chContainer.innerHTML = "";
    
    backBtn.onclick = () => {
        document.getElementById('search-input').value = "";
        renderSubjects();
    };

    let subObj = db.branches[branch][sem][subject] || {};
    let syllabusLink = subObj.syllabus || "";
    let chapters = subObj.chapters || [];

    // Syllabus Card Construction
    let syllabusHTML = "";
    if(syllabusLink && syllabusLink !== "#") {
        syllabusHTML = `
            <div class="box-card" style="border-left: 6px solid #10b981; background: rgba(16, 185, 129, 0.02); text-align: left; align-items: flex-start; min-height: auto; width: 100%; margin-bottom: 20px; padding: 20px;">
                <h3 style="color: #10b981; font-size: 1.2rem; font-weight: 600; margin-bottom: 5px;">📋 Official GTU Syllabus</h3>
                <p style="font-size: 13px; color: var(--text-light); margin-bottom: 15px; line-height: 1.5;">તમારા સત્તાવાર અભ્યાસક્રમની વિગતો અને ગુણ મૂલ્યાંકન પદ્ધતિ અહીં ડાઉનલોડ કરો.</p>
                <a href="${syllabusLink}" target="_blank" style="background:#d1fae5; color:#065f46; display: inline-flex; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; text-decoration: none;">🌐 View Syllabus PDF</a>
            </div>
        `;
    }

    // Previous Year Papers Hub Card Configuration
    let pyqHTML = `
        <div class="box-card" style="border-left: 6px solid #d97706; background: rgba(217, 119, 6, 0.02); text-align: left; align-items: flex-start; min-height: auto; width: 100%; margin-bottom: 20px; padding: 20px;">
            <h3 style="color: #d97706; font-size: 1.2rem; font-weight: 600; margin-bottom: 5px;">📜 Previous Year Papers (PYQs)</h3>
            <p style="font-size: 13px; color: var(--text-light); margin-bottom: 15px; line-height: 1.5;">તમારી પરીક્ષાની તૈયારી માટે જીટીયુ (GTU) ના પાછલા વર્ષોના ઓરિજિનલ પ્રશ્નપત્રો અહીંથી મેળવો.</p>
            <button onclick="openPYQListView('${branch}', '${sem}', '${subject}')" style="background: #fef3c7; color: #92400e; display: inline-flex; padding: 12px 24px; border: none; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer;">📄 View Papers PDF</button>
        </div>
    `;

    let chaptersHeader = `<h3 style="color: #2563eb; font-size: 1.15rem; font-weight: 600; padding-left: 5px; text-align: left; margin-bottom: 12px; width:100%;">📚 Reference Study Chapters & Notes</h3>`;
    
    chContainer.innerHTML = syllabusHTML + pyqHTML + chaptersHeader;

    if(chapters.length === 0) {
        chContainer.innerHTML += `<p style="font-size: 13px; color: var(--text-light); padding-left: 5px; text-align: left; width:100%;">આ પ્રકરણના અભ્યાસક્રમની સામગ્રી પ્રક્રિયા હેઠળ છે.</p>`;
    } else {
        chapters.forEach((ch, idx) => {
            let card = document.createElement('div');
            card.className = "box-card";
            card.style = "border-left: 4px solid #2563eb; text-align: left; align-items: flex-start; min-height: auto; width:100%; margin-bottom: 10px; padding: 18px 20px;";
            card.innerHTML = `<div style="font-size: 15px; font-weight: 600; color: var(--text-color);">📁 Chapter ${idx + 1}: ${ch.name}</div><span style="font-size: 12px; color: var(--text-light); margin-top:4px;">ક્લિક કરીને વિડીયો લેક્ચર્સ અને હેન્ડરાઇટિંગ પીડીએફ નોટ્સ મેળવો</span>`;
            card.onclick = () => renderMaterials(ch);
            chContainer.appendChild(card);
        });
    }
}

// ૨. પેપર લિસ્ટ વ્યુ (બીજું નવું સિંગલ પેજ વ્યુ - બટન નીચે View PDF સાથે)
function openPYQListView(branch, sem, subject) {
    let chContainer = document.getElementById('chapters-container');
    let pyqListContainer = document.getElementById('pyqs-container');
    let backBtn = document.getElementById('btn-back');

    chContainer.classList.add('hidden');
    pyqListContainer.classList.remove('hidden');
    
    document.getElementById('filter-heading').innerText = `📜 ${subject} - Papers`;
    pyqListContainer.innerHTML = "";

    // બેક બટન પર પાછા સબ્જેક્ટ હબ પેજ પર જાવ
    backBtn.onclick = () => openSubjectHub(branch, sem, subject);

    let papers = (db.pyqs && db.pyqs[branch] && db.pyqs[branch][sem] && db.pyqs[branch][sem][subject]) || [];
    
    if(papers.length === 0) {
        pyqListContainer.innerHTML = "<p style='padding:20px; color:var(--text-light); text-align:center; width:100%;'>આ વિષયના જૂના પ્રશ્નપત્રો ટૂંક સમયમાં ઉમેરવામાં આવશે.</p>";
    } else {
        papers.forEach((p) => {
            let card = document.createElement('div');
            card.className = "box-card";
            card.style = "display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-height: auto; width: 100%; margin-bottom: 15px; padding: 15px; text-align: left;";
            card.innerHTML = `
                <span style="font-size: 14px; font-weight: 600; color: var(--text-color);">📝 GTU Paper - ${p.year}</span>
                <a href="${p.link}" target="_blank" style="background: #d97706; color: white; padding: 8px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-block; text-align: center; margin-top: 4px;" onclick="trackProgress('pyq')">View PDF</a>
            `;
            pyqListContainer.appendChild(card);
        });
    }
}

function renderMaterials(chapter) {
    let chContainer = document.getElementById('chapters-container'); 
    let matContainer = document.getElementById('materials-container'); 
    let backBtn = document.getElementById('btn-back');
    
    chContainer.classList.add('hidden'); 
    matContainer.classList.remove('hidden');
    document.getElementById('filter-heading').innerText = `📁 ${chapter.name}`;
    matContainer.innerHTML = "";
    
    backBtn.onclick = () => { 
        matContainer.classList.add('hidden'); 
        openSubjectHub(currentOpenBranch, currentOpenSem, currentOpenSubject); 
    };

    let card = document.createElement('div'); card.className = "box-card"; card.style.width = "100%"; card.style.cursor = "default";
    card.innerHTML = `
        <span style="font-size:14px; color:var(--text-light); margin-bottom:10px;">Select Study Source</span>
        <div class="material-buttons">
            <a href="${chapter.yt || '#'}" target="_blank" class="btn-yt" onclick="trackProgress('video')">📺 YouTube Video</a>
            <a href="${chapter.pdf || '#'}" target="_blank" class="btn-pdf" onclick="trackProgress('pdf')">📄 PDF Notes</a>
        </div>
    `;
    matContainer.appendChild(card);
}

function renderPYQSubjects() {
    if(!tempGoogleUser) return;
    database.ref('registered_students/' + tempGoogleUser.uid).once('value').then((snapshot) => {
        let user = snapshot.val();
        let container = document.getElementById('pyqs-container');
        container.classList.remove('hidden');
        document.getElementById('filter-heading').innerText = "Select Subject for PYQs"; 
        container.innerHTML = "";

        let branchData = (db.pyqs && db.pyqs[user.branch]) || {}; 
        let semData = branchData[user.sem] || {}; 
        let subjects = Object.keys(semData);

        if(subjects.length === 0) {
            container.innerHTML = "<p style='padding:15px; color:var(--text-light);'>No PYQs uploaded for your branch/semester yet.</p>"; return;
        }
        subjects.forEach(sub => {
            let card = document.createElement('div'); card.className = "box-card"; card.innerHTML = `📝 ${sub}`;
            card.onclick = () => { document.getElementById('search-input').value = ""; renderPYQPapers(user.branch, user.sem, sub); };
            container.appendChild(card);
        });
    });
}

function renderPYQPapers(branch, sem, subject) {
    let container = document.getElementById('pyqs-container'); let matContainer = document.getElementById('materials-container'); let backBtn = document.getElementById('btn-back');

    container.classList.add('hidden'); matContainer.classList.remove('hidden'); backBtn.classList.remove('hidden');
    document.getElementById('filter-heading').innerText = `${subject} - Past Papers`; matContainer.innerHTML = "";
    backBtn.onclick = () => { document.getElementById('search-input').value = ""; matContainer.classList.add('hidden'); renderPYQSubjects(); backBtn.classList.add('hidden');};

    let papers = db.pyqs[branch][sem][subject] || [];
    if(papers.length === 0) { matContainer.innerHTML = "<p style='padding:15px; color:var(--text-light);'>No papers available.</p>"; return; }
    
    papers.forEach((p) => {
        let card = document.createElement('div'); card.className = "box-card"; card.style.width = "100%"; card.style.cursor = "default";
        card.innerHTML = `
            <span style="font-size:15px; font-weight:600; color:var(--text-color); margin-bottom:10px;">${p.year}</span>
            <div class="material-buttons" style="margin-top: 5px;">
                <a href="${p.link}" target="_blank" class="btn-pyq-action" onclick="trackProgress('pyq')">⬇️ Download PDF Paper</a>
            </div>
        `;
        matContainer.appendChild(card);
    });
}

function openModal(type) {
    if(!tempGoogleUser) return;
    toggleSidebar();
    let modal = document.getElementById('info-modal');
    let title = document.getElementById('modal-title');
    let body = document.getElementById('modal-body-text');
    let footer = document.getElementById('modal-footer-buttons');
    footer.innerHTML = `<button class="btn-close-modal" onclick="closeModal()">Close</button>`;

    database.ref('registered_students/' + tempGoogleUser.uid).once('value').then((snapshot) => {
        let user = snapshot.val();
        if (type === 'profile-edit' && user) {
            title.innerText = "Edit Profile";
            let branchOptionsHTML = "";
            let uniqueBranches = Object.keys(db.branches).length > 0 ? Object.keys(db.branches) : baseStaticBranches;
            uniqueBranches.forEach(b => { branchOptionsHTML += `<option value="${b}" ${user.branch === b ? 'selected' : ''}>${b}</option>`; });
            let semOptionsHTML = "";
            for(let i=1; i<=6; i++) { semOptionsHTML += `<option value="Sem ${i}" ${user.sem === `Sem ${i}` ? 'selected' : ''}>Sem ${i}</option>`; }
            body.innerHTML = `
                <div class="modal-form-group"><label>Student Name</label><input type="text" id="edit-name-field" value="${user.name}"></div>
                <div class="modal-form-group"><label>Enrollment Number</label><input type="text" id="edit-enroll-field" value="${user.enroll}" oninput="this.value = this.value.replace(/[^0-9]/g, '')"></div>
                <div class="modal-form-group"><label>Your Main Branch</label><select id="edit-branch-field">${branchOptionsHTML}</select></div>
                <div class="modal-form-group"><label>Current Semester</label><select id="edit-sem-field">${semOptionsHTML}</select></div>
            `;
            footer.innerHTML = `<button class="btn-save-modal" onclick="updateProfileData()">Save Changes 💾</button><button class="btn-close-modal" onclick="closeModal()">Cancel</button>`;
        }
        else if(type === 'about') { 
            title.innerText = "About Our Portal ℹ️"; 
            body.innerHTML = `<h3>Empowering GTU Diploma Engineering Students</h3><p style="font-size: 13px; color: var(--text-light); line-height:1.6; margin-top:10px;">Diploma Study Portal My એક ઓનલાઈન શૈક્ષણિક પ્લેટફોર્મ છે જે ગુજરાત ટેકનોલોજીકલ યુનિવર્સિટી (GTU) ના ડિપ્લોમા એન્જીનીયરીંગ વિદ્યાર્થીઓ માટે ખાસ બનાવવામાં આવ્યું છે. અહીં સચોટ સિલેબસ મુજબ મટીરીયલ્સ, પ્રકરણવાઇઝ યુટ્યુબ લેકચર્સ અને પાછલા વર્ષોના પ્રશ્નપત્રો ઉપલબ્ધ કરવામાં આવે છે.</p>`; 
        } 
        else if(type === 'contact') {
            title.innerText = "Contact Us 📞";
            body.innerHTML = `<h3>કોઈપણ પ્રશ્ન કે સમસ્યા માટે સંપર્ક કરો:</h3>
            <p style="font-size: 14px; margin-top:10px; line-height:1.8;">📧 Email: <b>vahorarehan5510@gmail.com</b><br>💬 Discussion Forum માં એડમિનને સીધો પ્રશ્ન પૂછી શકો છો.<br>📍 Vadodara, Gujarat, India.</p>`;
        }
        else if(type === 'privacy') {
            title.innerText = "Privacy Policy 🔒";
            body.innerHTML = `<h3>તમારી સુરક્ષા અમારી પ્રાથમિકતા છે</h3>
            <p style="font-size: 12px; color: var(--text-light); line-height:1.6; margin-top:10px;">અમે ગુગલ ઓથેન્ટિકેશન (Google Login) દ્વારા સુરક્ષિત લોગીન પ્રદાન કરીએ છીએ. તમારો ડેટા (નામ, ઈમેલ અને એકેડેમિક વિગતો) Firebase ક્લાઉડ ડેટાબેઝમાં એન્ક્રિપ્ટેડ ફોર્મેટમાં સુરક્ષિત રહે છે. અમે ક્યારેય કોઈપણ ત્રીજી સંસ્થા (Third-party) સાથે ડેટા શેર કરતા નથી.</p>`;
        }
        modal.classList.add('active');
    });
}

function updateProfileData() {
    if(!tempGoogleUser) return;
    database.ref('registered_students/' + tempGoogleUser.uid).once('value').then((snapshot) => {
        let user = snapshot.val();
        let newName = document.getElementById('edit-name-field').value.trim();
        let newEnroll = document.getElementById('edit-enroll-field').value.trim();
        if(!newName || !newEnroll) { alert("Details incomplete!"); return; }
        user.name = newName; user.enroll = newEnroll; user.branch = document.getElementById('edit-branch-field').value; user.sem = document.getElementById('edit-sem-field').value;
        database.ref('registered_students/' + user.uid).set(user).then(() => {
            closeModal(); showHomePage(user);
        });
    });
}

function deleteOwnAccount() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    if (confirm("શું તમે તમારું એકાઉન્ટ અને બધો જ પ્રોગ્રેસ ડેટા કાયમ માટે ડિલીટ કરવા માંગો છો? આ પ્રોસેસ પાછી નહીં થાય.")) {
        database.ref('registered_students/' + user.uid).remove().then(() => {
            user.delete().then(() => {
                alert("તમારું એકાઉન્ટ સક્સેસફુલી ડિલીટ થઈ ગયું છે.");
                location.reload();
            }).catch(() => {
                alert("સિક્યોરિટી પ્રોટેક્શનના કારણે પ્લીઝ એકવાર લોગઆઉટ કરીને ફરી લોગીન કરો, પછી એકાઉન્ટ ડિલીટ કરો.");
            });
        });
    }
}

function shareApp() {
    const shareText = "📚 Boost Your GTU Diploma Prep! 🎓\n👉 Join now:\n" + window.location.href;
    if (navigator.share) { navigator.share({ title: "GTU Portal", text: shareText }).catch(err => console.log('Error sharing')); } 
    else { alert("Copy this link and share with friends: \n" + window.location.href); }
}

function openPaymentModal(user, branch, sem, subject, price) {
    let modal = document.getElementById('info-modal');
    let title = document.getElementById('modal-title');
    let body = document.getElementById('modal-body-text');
    let footer = document.getElementById('modal-footer-buttons');

    title.innerText = `🔒 Unlock ${subject}`;
    let upiString = `upi://pay?pa=${MY_UPI_ID}&pn=DiplomaStudyPortal&tn=${encodeURIComponent(subject + ' ' + user.name)}&am=${price}&cu=INR`;
    let qrChartUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;

    body.innerHTML = `
        <div style="text-align:center;">
            <p style="margin-bottom:15px; font-size:14px; color:var(--text-color);">આ પ્રીમિયમ વિષય અનલોક કરવા માટે <b>₹${price}</b> સ્કેન કરો.</p>
            <img src="${qrChartUrl}" alt="UPI QR Code" style="border:1px solid #ddd; padding:10px; border-radius:12px; background:white; margin-bottom:15px;">
            <p style="font-size:12px; color:var(--text-light); margin-bottom:15px;">UPI ID: <b>${MY_UPI_ID}</b></p>
            <div class="modal-form-group">
                <label>પેમેન્ટ કર્યા પછી ૧૨-આંકડાનો UTR / Transaction ID અહીં લખો:</label>
                <input type="text" id="pay-utr-input" placeholder="e.g. 412589632514" maxlength="12" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
            </div>
        </div>
    `;

    footer.innerHTML = `
        <button class="btn-save-modal" onclick="submitPaymentDetails('${user.uid}', '${subject}', ${price})">સબમિટ કરો (Submit)</button>
        <button class="btn-close-modal" onclick="closeModal()">કેન્સલ (Cancel)</button>
    `;
    modal.classList.add('active');
}

function toggleSidebar() {
    let sidebar = document.getElementById('sidebar'); let overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) {
        sidebar.classList.toggle('active'); overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
    }
}
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function logout() { firebase.auth().signOut().then(() => location.reload()); }
function closeModal() { document.getElementById('info-modal').classList.remove('active'); }
function loadUserProfilePhoto(user) {
    let avatar = document.getElementById('user-avatar');
    if(avatar) {
        if(user && user.photo) { avatar.innerHTML = `<img src="${user.photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`; } 
        else { avatar.innerHTML = "🎓"; }
    }
}

function calculateLiveCounters() {
    let totalBranches = db.branches ? Object.keys(db.branches).length : 0;
    let totalSubjects = 0;
    if(db.branches) {
        Object.keys(db.branches).forEach(b => {
            Object.keys(db.branches[b]).forEach(sem => {
                let subs = db.branches[b][sem] || {}; totalSubjects += Object.keys(subs).length;
            });
        });
    }
    const bCount = document.getElementById('stat-branches');
    const sCount = document.getElementById('stat-subjects');
    const stCount = document.getElementById('stat-students');
    
    if(bCount) bCount.innerText = totalBranches;
    if(sCount) sCount.innerText = totalSubjects;
    
    database.ref('registered_students').once('value').then(snap => {
        if(stCount) stCount.innerText = snap.exists() ? Object.keys(snap.val()).length : 0;
    });
}

function validateAndNext(current, next) {
    let currentInput = document.querySelector(`#q-step-${current} input, #q-step-${current} select`);
    let errorDiv = document.querySelector(`#q-step-${current} .error-text`);
    if (currentInput && !currentInput.value.trim()) { if(errorDiv) errorDiv.style.display = 'block'; } 
    else {
        if(errorDiv) errorDiv.style.display = 'none';
        document.getElementById(`q-step-${current}`).classList.add('hidden');
        document.getElementById(`q-step-${next}`).classList.remove('hidden');
    }
}

function populateDropdowns() {
    let regBranchSelect = document.getElementById('reg-branch-select');
    let regSemSelect = document.getElementById('reg-sem');
    if(!regBranchSelect || !regSemSelect) return;
    
    regBranchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
    let branchList = (db && db.branches && Object.keys(db.branches).length > 0) ? Object.keys(db.branches) : baseStaticBranches;
    branchList.forEach(b => {
        regBranchSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });

    regBranchSelect.onchange = function() {
        regSemSelect.innerHTML = '<option value="">-- Select Semester --</option>';
        if(this.value) {
            for(let i=1; i<=6; i++) {
                regSemSelect.innerHTML += `<option value="Sem ${i}">Sem ${i}</option>`;
            }
        }
    };
}
