import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- CONFIGURACIÓN FIREBASE FIRESTORE ---
const firebaseConfig = {
  projectId: "metrenco-reservas-app",
  appId: "1:1080678458222:web:41c9785c702add6815577f",
  storageBucket: "metrenco-reservas-app.firebasestorage.app",
  apiKey: "AIzaSyBN17i1sN4hSOllyla4ASbzPWIgip552Jw",
  authDomain: "metrenco-reservas-app.firebaseapp.com",
  messagingSenderId: "1080678458222"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const reservasRef = collection(db, "reservas");
const docentesRef = collection(db, "docentes");

// --- CONSTANTES ---
const BLOCKS_MON_THU = [
    "08:30 a 10:00",
    "10:15 a 11:45",
    "12:00 a 13:30",
    "14:30 a 15:45"
];
const BLOCKS_FRI = [
    "08:30 a 10:00",
    "10:15 a 11:45",
    "12:00 a 13:30"
];

const BRIDGE_EMAIL = "acceso_docentes@docente.metrenco.cl";
const BRIDGE_PASS = "SistemaMetrencoAdminBD_2026!";

// --- ESTADO INICIAL ---
let reservas = []; // Se poblará desde Firebase Firestore
let docentesLista = []; // Se poblará desde Firebase Firestore
let isAdminLogged = false;
let currentDocente = null; // { uid, nombre, usuario }
let isFirestoreListening = false; // Flag para evitar múltiples listeners

// --- REFERENCIAS AL DOM ---
const viewDocenteAuth = document.getElementById('docenteAuthView'); // La principal ahora
const viewDocente = document.getElementById('docenteView'); // Formulario + Dashboard mis reservas
const viewAdminLogin = document.getElementById('adminLoginView');
const viewAdminDashboard = document.getElementById('adminDashboardView');

const navAdminBtn = document.getElementById('navAdminBtn');
const navDocenteBtn = document.getElementById('navDocenteBtn');
const navDocenteLoginBtn = document.getElementById('navDocenteLoginBtn');
const logoutDocenteBtn = document.getElementById('logoutDocenteBtn');
const docenteNameDisplay = document.getElementById('docenteNameDisplay');

// Formularios Reserva
const reservaForm = document.getElementById('reservaForm');
const fieldProfesor = document.getElementById('profesor');
const fieldFecha = document.getElementById('fecha');
const fieldBloque = document.getElementById('bloque');
const btnSubmitReserva = document.getElementById('btnSubmitReserva');

// Auth Docente
const tabLoginDocente = document.getElementById('tabLoginDocente');
const tabRegisterDocente = document.getElementById('tabRegisterDocente');
const formLoginDocenteWrap = document.getElementById('formLoginDocenteWrap');
const formRegisterDocenteWrap = document.getElementById('formRegisterDocenteWrap');

const docenteLoginForm = document.getElementById('docenteLoginForm');
const docenteLoginError = document.getElementById('docenteLoginError');
const docenteRegisterForm = document.getElementById('docenteRegisterForm');
const docenteRegError = document.getElementById('docenteRegError');

// Dashboard Docente
const misReservasTbody = document.getElementById('misReservasTbody');
const noMisReservasMsg = document.getElementById('noMisReservasMsg');

// Auth Admin
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');

// Dashboard Admin
const reservasTbody = document.getElementById('reservasTbody');
const noReservasMsg = document.getElementById('noReservasMsg');
const btnExportPDF = document.getElementById('btnExportPDF');
const exportFechaInicio = document.getElementById('exportFechaInicio');
const exportFechaFin = document.getElementById('exportFechaFin');

// Formulario Asignación Admin
const adminReservaForm = document.getElementById('adminReservaForm');
const adminSelectProfesor = document.getElementById('adminSelectProfesor');
const adminFecha = document.getElementById('adminFecha');
const adminBloque = document.getElementById('adminBloque');
const adminCurso = document.getElementById('adminCurso');
const adminAsignatura = document.getElementById('adminAsignatura');
const adminObjetivo = document.getElementById('adminObjetivo');
const btnAdminSubmitReserva = document.getElementById('btnAdminSubmitReserva');

// Formulario Cambio Contraseñas Admin
const adminPasswordForm = document.getElementById('adminPasswordForm');
const adminSelectPassProfesor = document.getElementById('adminSelectPassProfesor');
const adminNewPassword = document.getElementById('adminNewPassword');
const passChangeSuccess = document.getElementById('passChangeSuccess');

// Formulario Crear Nuevo Docente Admin
const adminCreateDocenteForm = document.getElementById('adminCreateDocenteForm');
const adminNewDocenteName = document.getElementById('adminNewDocenteName');
const adminNewDocenteUser = document.getElementById('adminNewDocenteUser');
const adminNewDocentePass = document.getElementById('adminNewDocentePass');
const docenteCreateSuccess = document.getElementById('docenteCreateSuccess');
const docenteCreateError = document.getElementById('docenteCreateError');

// --- INICIALIZACIÓN ---
function init() {
    setupEventListeners();
    setMinDate();
    listenToAuth();
}

function listenToAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check if admin
            if (user.email === 'admin@admin.metrenco.cl') {
                isAdminLogged = true;
                currentDocente = null;
                listenToFirestore(); // <-- Start listening after authentication
                showAdminDashboard();
                return;
            }

            // Si es la cuenta puente (docentes)
            if (user.email === BRIDGE_EMAIL) {
                const savedId = localStorage.getItem('loggedDocenteId');
                if (savedId) {
                    const docSnap = await getDoc(doc(db, "docentes", savedId));
                    if (docSnap.exists()) {
                        currentDocente = { uid: docSnap.id, ...docSnap.data() };
                        listenToFirestore();
                        handleDocenteLoggedIn();
                    } else {
                        // Docente fue borrado
                        localStorage.removeItem('loggedDocenteId');
                        currentDocente = null;
                        handleDocenteLoggedOut();
                    }
                } else {
                    currentDocente = null;
                    handleDocenteLoggedOut();
                }
                return;
            }

            // Migración: si entran con su cuenta antigua, los expulsamos a favor del nuevo sistema
            auth.signOut();
        } else {
            currentDocente = null;
            isAdminLogged = false;
            handleDocenteLoggedOut();
        }
    });
}

function handleDocenteLoggedIn() {
    docenteNameDisplay.textContent = `Hola, ${currentDocente.nombre}`;
    docenteNameDisplay.classList.remove('d-none');
    logoutDocenteBtn.classList.remove('d-none');
    navDocenteLoginBtn.classList.add('d-none');
    
    // Auth UI state
    fieldProfesor.value = currentDocente.nombre;
    fieldFecha.disabled = false;
    btnSubmitReserva.disabled = false;
    
    showDocenteView();
    if(isAdminLogged) handleLogout();
}

function handleDocenteLoggedOut() {
    docenteNameDisplay.classList.add('d-none');
    logoutDocenteBtn.classList.add('d-none');
    navDocenteLoginBtn.classList.remove('d-none');
    
    // Auth UI state
    fieldProfesor.value = "";
    fieldFecha.disabled = true;
    btnSubmitReserva.disabled = true;
    
    showDocenteAuthView();
}

function setupEventListeners() {
    // Navegación principal
    navAdminBtn.addEventListener('click', showAdminLogin);
    navDocenteLoginBtn.addEventListener('click', showDocenteAuthView);
    btnLogout.addEventListener('click', handleLogout);
    logoutDocenteBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedDocenteId');
        currentDocente = null;
        handleDocenteLoggedOut();
    });

    // Eventos Formulario Docente
    fieldFecha.addEventListener('change', handleFechaChange);
    reservaForm.addEventListener('submit', handleReservaSubmit);

    // Eventos Auth Docente
    tabLoginDocente.addEventListener('click', () => switchDocenteAuthTab('login'));
    tabRegisterDocente.addEventListener('click', () => switchDocenteAuthTab('register'));
    docenteLoginForm.addEventListener('submit', handleDocenteLogin);
    docenteRegisterForm.addEventListener('submit', handleDocenteRegister);

    // Eventos Admin Login
    loginForm.addEventListener('submit', handleLogin);
    if (adminPasswordForm) adminPasswordForm.addEventListener('submit', handleAdminPasswordChange);
    if (adminCreateDocenteForm) adminCreateDocenteForm.addEventListener('submit', handleAdminCreateDocente);

    // Eventos Formulario Admin Asignación
    if (adminFecha) adminFecha.addEventListener('change', handleAdminFechaChange);
    if (adminReservaForm) adminReservaForm.addEventListener('submit', handleAdminReservaSubmit);

    // Eventos Dashboard
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', handleExportPDF);
    }
}

// --- LOGICA CORE FIREBASE LECTURAS EN TIEMPO REAL ---
function listenToFirestore() {
    if (isFirestoreListening) return;
    
    const q = query(reservasRef, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        reservas = [];
        snapshot.forEach((docSnap) => {
            reservas.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        if (isAdminLogged) renderDashboard();
        if (currentDocente && viewDocente.classList.contains('active')) renderDocenteDashboard();
        if (fieldFecha && fieldFecha.value) handleFechaChange();
        if (adminFecha && adminFecha.value) handleAdminFechaChange();
    });

    // Escuchar colección docentes para el select de admin
    onSnapshot(docentesRef, (snapshot) => {
        docentesLista = [];
        if(adminSelectProfesor) adminSelectProfesor.innerHTML = '<option value="">Seleccione un profesor...</option>';
        if(adminSelectPassProfesor) adminSelectPassProfesor.innerHTML = '<option value="">Seleccione un profesor...</option>';
        
        snapshot.forEach((docSnap) => {
            docentesLista.push({ uid: docSnap.id, ...docSnap.data() });
        });
        
        const sortedList = docentesLista.sort((a,b) => {
            const nameA = a.nombre || "";
            const nameB = b.nombre || "";
            return nameA.localeCompare(nameB);
        });

        sortedList.forEach(docente => {
            const nombreMostrar = docente.nombre || "Sin nombre";
            const textoDisplay = docente.usuario ? `${nombreMostrar} (${docente.usuario})` : nombreMostrar;
            
            if(adminSelectProfesor) {
                const option = document.createElement('option');
                option.value = docente.uid;
                option.textContent = textoDisplay;
                option.dataset.nombre = nombreMostrar; // Se guarda el nombre original limpio para la asignación
                adminSelectProfesor.appendChild(option);
            }
            if(adminSelectPassProfesor) {
                const opt2 = document.createElement('option');
                opt2.value = docente.uid;
                opt2.textContent = textoDisplay + (!docente.password ? ' (⚠️ Sin Clave)' : '');
                adminSelectPassProfesor.appendChild(opt2);
            }
        });
    });

    isFirestoreListening = true;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- CONTROLADOR DE VISTAS ---
function hideAllViews() {
    viewDocente.classList.remove('active'); viewDocente.classList.add('d-none');
    viewAdminLogin.classList.remove('active'); viewAdminLogin.classList.add('d-none');
    viewAdminDashboard.classList.remove('active'); viewAdminDashboard.classList.add('d-none');
    viewDocenteAuth.classList.remove('active'); viewDocenteAuth.classList.add('d-none');
}

function showDocenteView() {
    if(!currentDocente) return showDocenteAuthView();
    
    hideAllViews();
    viewDocente.classList.add('active');
    viewDocente.classList.remove('d-none');
    
    navAdminBtn.classList.remove('d-none');
    navDocenteLoginBtn.classList.add('d-none');
    
    if (fieldFecha.value) handleFechaChange();
    renderDocenteDashboard();
}

function showAdminLogin() {
    if (isAdminLogged) {
        showAdminDashboard();
        return;
    }
    hideAllViews();
    viewAdminLogin.classList.add('active');
    viewAdminLogin.classList.remove('d-none');
    
    navAdminBtn.classList.add('d-none');
    navDocenteLoginBtn.classList.add('d-none');
    loginError.classList.add('d-none');
}

function showAdminDashboard() {
    hideAllViews();
    viewAdminDashboard.classList.add('active');
    viewAdminDashboard.classList.remove('d-none');
    
    navAdminBtn.classList.add('d-none');
    navDocenteLoginBtn.classList.remove('d-none');
    
    renderDashboard();
}

function showDocenteAuthView() {
    if(currentDocente) return showDocenteView();
    hideAllViews();
    viewDocenteAuth.classList.add('active');
    viewDocenteAuth.classList.remove('d-none');
    
    navAdminBtn.classList.remove('d-none');
    navDocenteLoginBtn.classList.add('d-none');
}

// --- LOGICA AUTH DOCENTE ---
function switchDocenteAuthTab(tab) {
    if (tab === 'login') {
        tabLoginDocente.classList.add('active');
        tabLoginDocente.style.color = 'var(--primary-color)';
        tabLoginDocente.style.borderBottomColor = 'var(--primary-color)';
        tabRegisterDocente.classList.remove('active');
        tabRegisterDocente.style.color = 'var(--text-muted)';
        tabRegisterDocente.style.borderBottomColor = 'transparent';
        
        formLoginDocenteWrap.classList.remove('d-none');
        formRegisterDocenteWrap.classList.add('d-none');
    } else {
        tabRegisterDocente.classList.add('active');
        tabRegisterDocente.style.color = 'var(--primary-color)';
        tabRegisterDocente.style.borderBottomColor = 'var(--primary-color)';
        tabLoginDocente.classList.remove('active');
        tabLoginDocente.style.color = 'var(--text-muted)';
        tabLoginDocente.style.borderBottomColor = 'transparent';
        
        formRegisterDocenteWrap.classList.remove('d-none');
        formLoginDocenteWrap.classList.add('d-none');
    }
}

async function handleDocenteLogin(e) {
    e.preventDefault();
    const user = document.getElementById('docenteUserLogin').value.trim();
    const pass = document.getElementById('docentePassLogin').value;
    
    try {
        if (!auth.currentUser || auth.currentUser.email !== BRIDGE_EMAIL) {
            try {
                await signInWithEmailAndPassword(auth, BRIDGE_EMAIL, BRIDGE_PASS);
            } catch(e) {
                if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
                    await createUserWithEmailAndPassword(auth, BRIDGE_EMAIL, BRIDGE_PASS);
                } else throw e;
            }
        }

        const querySnapshot = await getDocs(docentesRef);
        let match = null;
        let requiresAdminReset = false;

        const inputSafeUser = user.toLowerCase().replace(/[^a-z0-9]/g, '');

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dbSafeUser = (data.usuario || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (dbSafeUser === inputSafeUser) {
                if (!data.password) requiresAdminReset = true;
                if (data.password === pass) {
                    match = { uid: docSnap.id, ...data };
                }
            }
        });

        if (match) {
            localStorage.setItem('loggedDocenteId', match.uid);
            currentDocente = match;
            docenteLoginForm.reset();
            docenteLoginError.classList.add('d-none');
            listenToFirestore();
            handleDocenteLoggedIn();
        } else if (requiresAdminReset) {
            docenteLoginError.textContent = "Tu contraseña ha expirado debido a mejoras de seguridad. Solicita al administrador tu nueva contraseña temporal.";
            docenteLoginError.classList.remove('d-none');
        } else {
            docenteLoginError.textContent = "Credenciales incorrectas o usuario no existe.";
            docenteLoginError.classList.remove('d-none');
        }
    } catch(err) {
        docenteLoginError.textContent = "Error interno o de conexión.";
        docenteLoginError.classList.remove('d-none');
        console.error(err);
    }
}

async function handleDocenteRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById('docenteNameReg').value.trim();
    const user = document.getElementById('docenteUserReg').value.trim();
    const pass = document.getElementById('docentePassReg').value;
    const pass2 = document.getElementById('docentePassRegConfirm').value;
    
    if (pass !== pass2) {
        docenteRegError.textContent = "Las contraseñas no coinciden.";
        docenteRegError.classList.remove('d-none');
        return;
    }
    
    const safeUser = user.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (safeUser.length === 0) {
        docenteRegError.textContent = "El usuario debe contener al menos una letra o número válido.";
        docenteRegError.classList.remove('d-none');
        return;
    }
    
    try {
        if (!auth.currentUser || auth.currentUser.email !== BRIDGE_EMAIL) {
            try {
                await signInWithEmailAndPassword(auth, BRIDGE_EMAIL, BRIDGE_PASS);
            } catch(e) {
                if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
                    await createUserWithEmailAndPassword(auth, BRIDGE_EMAIL, BRIDGE_PASS);
                } else throw e;
            }
        }

        let usernameExists = false;
        const scanSnapshot = await getDocs(docentesRef);
        scanSnapshot.forEach(docSnap => {
             const data = docSnap.data();
             const dbSafeUser = (data.usuario || '').toLowerCase().replace(/[^a-z0-9]/g, '');
             if (dbSafeUser === safeUser) usernameExists = true;
        });

        if (usernameExists) {
            docenteRegError.textContent = "El nombre de usuario ya está registrado.";
            docenteRegError.classList.remove('d-none');
            return;
        }

        await addDoc(docentesRef, {
            nombre: nombre,
            usuario: user, 
            password: pass // Guardado directo a DB
        });
        
        docenteRegisterForm.reset();
        docenteRegError.classList.add('d-none');
        showToast("Cuenta creada exitosamente");
        switchDocenteAuthTab('login');
    } catch(err) {
        docenteRegError.textContent = "Error al registrar: " + err.message;
        docenteRegError.classList.remove('d-none');
        console.error(err);
    }
}

// --- LOGICA FORMULARIO DOCENTE ---
function setMinDate() {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().split('T')[0];
    if(fieldFecha) fieldFecha.setAttribute('min', localISOTime);
    if(adminFecha) adminFecha.setAttribute('min', localISOTime);
}

function isWeekend(dateString) {
    const date = new Date(`${dateString}T00:00:00`); 
    const day = date.getDay();
    return (day === 6 || day === 0);
}

function getDayOfWeek(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.getDay(); 
}

function getAvailableBlocks(dateString) {
    const day = getDayOfWeek(dateString);
    const isFriday = day === 5;
    const baseBlocks = isFriday ? [...BLOCKS_FRI] : [...BLOCKS_MON_THU];
    
    const reservedOnDateMap = {};
    reservas
        .filter(r => r.fecha === dateString)
        .forEach(r => {
            reservedOnDateMap[r.bloque] = r.profesor;
        });

    return {
        base: baseBlocks,
        reserved: reservedOnDateMap
    };
}

function handleFechaChange() {
    const fecha = fieldFecha.value;
    
    fieldBloque.innerHTML = '<option value="">Seleccione un bloque...</option>';
    fieldBloque.disabled = true;

    if (!fecha) return;

    if (isWeekend(fecha)) {
        alert("Atención: Solo se puede reservar la sala de lunes a viernes.");
        fieldFecha.value = "";
        return;
    }

    const blocksData = getAvailableBlocks(fecha);
    
    blocksData.base.forEach(b => {
        const option = document.createElement('option');
        option.value = b;
        option.textContent = b;
        
        if (blocksData.reserved[b]) {
            option.disabled = true;
            option.textContent += ` (Ocupado por ${blocksData.reserved[b]})`;
        }
        
        fieldBloque.appendChild(option);
    });

    fieldBloque.disabled = false;
}

async function handleReservaSubmit(e) {
    e.preventDefault();

    const profesor = document.getElementById('profesor').value.trim();
    const fecha = fieldFecha.value;
    const bloque = fieldBloque.value;
    const curso = document.getElementById('curso').value;
    const asignatura = document.getElementById('asignatura').value;
    const objetivo = document.getElementById('objetivo').value.trim();

    // Verificación sincrónica de límites del mes
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const selectedDate = new Date(`${fecha}T00:00:00`);
    if (selectedDate.getMonth() !== currentMonth || selectedDate.getFullYear() !== currentYear) {
        alert("Las reservas solo están permitidas para el mes en curso.");
        fieldFecha.value = "";
        handleFechaChange();
        return;
    }

    // Verificación sincrónica antes de envío
    const blocksData = getAvailableBlocks(fecha);
    if (blocksData.reserved[bloque]) {
        alert("Error crítico: El bloque seleccionado acaba de ser reservado. Por favor elija otro.");
        handleFechaChange();
        return;
    }

    // Inhabilitar botón para evitar multi-clicks
    btnSubmitReserva.disabled = true;
    btnSubmitReserva.textContent = "Procesando...";

    try {
        await addDoc(reservasRef, {
            profesor, // Traído del perfil guardado
            uidDocente: currentDocente.uid, // Referencia al usuario de Firebase Auth
            fecha,
            bloque,
            curso,
            asignatura,
            objetivo,
            estado: 'Pendiente', 
            createdAt: serverTimestamp() // Guardado universal en la nube
        });
        
        showToast("Gracias por solicitar la sala de informática");
        
        // Limpiar pero conservar nombre de profesor
        reservaForm.reset();
        if (currentDocente) {
            fieldProfesor.value = currentDocente.nombre;
            fieldProfesor.disabled = true; // explicitly re-disable just in case
        }
        
        fieldBloque.innerHTML = '<option value="">Seleccione una fecha primero...</option>';
        fieldBloque.disabled = true;
    } catch(err) {
        console.error("Error al guardar reserva: ", err);
        alert("Ha ocurrido un error de conexión al enviar. Verifique su internet y reintente.");
    } finally {
        btnSubmitReserva.disabled = false;
        btnSubmitReserva.textContent = "Enviar Solicitud";
    }
}

// --- LOGICA FORMULARIO ADMIN ASIGNACION ---
function handleAdminFechaChange() {
    const fecha = adminFecha.value;
    
    adminBloque.innerHTML = '<option value="">Seleccione un bloque...</option>';
    adminBloque.disabled = true;

    if (!fecha) return;

    if (isWeekend(fecha)) {
        alert("Atención: Solo se puede reservar la sala de lunes a viernes.");
        adminFecha.value = "";
        return;
    }

    const blocksData = getAvailableBlocks(fecha);
    
    blocksData.base.forEach(b => {
        const option = document.createElement('option');
        option.value = b;
        option.textContent = b;
        
        if (blocksData.reserved[b]) {
            option.disabled = true;
            option.textContent += ` (Ocupado por ${blocksData.reserved[b]})`;
        }
        
        adminBloque.appendChild(option);
    });

    adminBloque.disabled = false;
}

async function handleAdminReservaSubmit(e) {
    e.preventDefault();

    const selectEl = document.getElementById('adminSelectProfesor');
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const uidDocente = selectEl.value;
    const profesor = selectedOption.dataset.nombre;
    
    const fecha = adminFecha.value;
    const bloque = adminBloque.value;
    const curso = adminCurso.value;
    const asignatura = adminAsignatura.value;
    const objetivo = adminObjetivo.value.trim();

    // Verificación sincrónica de límites del mes
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const selectedDate = new Date(`${fecha}T00:00:00`);
    if (selectedDate.getMonth() !== currentMonth || selectedDate.getFullYear() !== currentYear) {
        alert("Las reservas solo están permitidas para el mes en curso.");
        adminFecha.value = "";
        handleAdminFechaChange();
        return;
    }

    const blocksData = getAvailableBlocks(fecha);
    if (blocksData.reserved[bloque]) {
        alert("Error crítico: El bloque seleccionado acaba de ser reservado. Por favor elija otro.");
        handleAdminFechaChange();
        return;
    }

    btnAdminSubmitReserva.disabled = true;
    btnAdminSubmitReserva.textContent = "Cargando...";

    try {
        await addDoc(reservasRef, {
            profesor, // Nombre real del profesor listado
            uidDocente, // ID real para vincular la reserva al perfil del profe
            fecha,
            bloque,
            curso,
            asignatura,
            objetivo,
            estado: 'Pendiente', 
            createdAt: serverTimestamp() 
        });
        
        showToast("Asignación registrada exitosamente");
        
        adminReservaForm.reset();
        adminBloque.innerHTML = '<option value="">Seleccione una fecha primero...</option>';
        adminBloque.disabled = true;
    } catch(err) {
        console.error("Error al guardar reserva: ", err);
        alert("Ha ocurrido un error al asignar.");
    } finally {
        btnAdminSubmitReserva.disabled = false;
        btnAdminSubmitReserva.textContent = "Asignar Reserva";
    }
}

async function handleAdminPasswordChange(e) {
    e.preventDefault();
    const uid = adminSelectPassProfesor.value;
    const newPass = adminNewPassword.value;
    
    if (!uid) {
        alert("Seleccione un profesor");
        return;
    }
    
    const btn = document.getElementById('btnAdminSubmitPassword');
    btn.disabled = true;
    btn.textContent = "Actualizando...";
    
    try {
        await updateDoc(doc(db, "docentes", uid), {
            password: newPass
        });
        
        passChangeSuccess.classList.remove('d-none');
        adminPasswordForm.reset();
        
        setTimeout(() => passChangeSuccess.classList.add('d-none'), 4000);
    } catch(err) {
        console.error(err);
        alert("Ocurrió un error al actualizar.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Actualizar Contraseña";
    }
}

async function handleAdminCreateDocente(e) {
    e.preventDefault();
    const nombre = adminNewDocenteName.value.trim();
    const user = adminNewDocenteUser.value.trim();
    const pass = adminNewDocentePass.value.trim();
    
    if (!nombre || !user || !pass) {
        alert("Complete todos los campos");
        return;
    }

    const safeUser = user.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (safeUser.length === 0) {
        alert("El usuario debe contener al menos una letra o número válido.");
        return;
    }

    const btn = document.getElementById('btnAdminCreateDocente');
    btn.disabled = true;
    btn.textContent = "Creando...";
    docenteCreateError.classList.add('d-none');
    
    try {
        // Verificar si el usuario ya existe
        let usernameExists = false;
        const scanSnapshot = await getDocs(docentesRef);
        scanSnapshot.forEach(docSnap => {
             const data = docSnap.data();
             const dbSafeUser = (data.usuario || '').toLowerCase().replace(/[^a-z0-9]/g, '');
             if (dbSafeUser === safeUser) usernameExists = true;
        });

        if (usernameExists) {
            docenteCreateError.textContent = "El nombre de usuario ya está registrado.";
            docenteCreateError.classList.remove('d-none');
            return;
        }

        await addDoc(docentesRef, {
            nombre: nombre,
            usuario: user, 
            password: pass
        });
        
        docenteCreateSuccess.classList.remove('d-none');
        adminCreateDocenteForm.reset();
        
        setTimeout(() => docenteCreateSuccess.classList.add('d-none'), 4000);
    } catch(err) {
        console.error(err);
        docenteCreateError.textContent = "Ocurrió un error al crear el usuario.";
        docenteCreateError.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.textContent = "Crear Usuario";
    }
}

// --- LÓGICA DE ADMINISTRADOR ---
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (user === 'admin' && pass === 'admin123') {
        const adminEmail = 'admin@admin.metrenco.cl';
        const loginBtn = document.querySelector('#loginForm button[type="submit"]');
        if(loginBtn) loginBtn.textContent = "Ingresando...";

        try {
            await signInWithEmailAndPassword(auth, adminEmail, pass);
        } catch(err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                try {
                    await createUserWithEmailAndPassword(auth, adminEmail, pass);
                } catch(regErr) {
                    console.error("Error creando cuenta admin ", regErr);
                }
            }
        }
        if(loginBtn) loginBtn.textContent = "Ingresar";

        isAdminLogged = true;
        loginForm.reset();
        showAdminDashboard();
    } else {
        loginError.classList.remove('d-none');
    }
}

function handleLogout() {
    isAdminLogged = false;
    signOut(auth);
    showDocenteAuthView();
}

function getStatusClass(statusStr) {
    if (statusStr === 'Pendiente') return 'status-Pendiente';
    if (statusStr === 'Asistió') return 'status-Asistio';
    if (statusStr === 'No asistió') return 'status-NoAsistio';
    return '';
}

function renderDashboard() {
    reservasTbody.innerHTML = '';
    
    if (reservas.length === 0) {
        noReservasMsg.classList.remove('d-none');
        document.querySelector('.table-responsive').classList.add('d-none');
        return;
    }

    noReservasMsg.classList.add('d-none');
    document.querySelector('.table-responsive').classList.remove('d-none');

    const sortedReservas = [...reservas].sort((a, b) => {
        const dateA = new Date(a.fecha);
        const dateB = new Date(b.fecha);
        // Fecha de reserva futura primero o viceversa (según convenga)
        if (dateB.getTime() !== dateA.getTime()){
            return dateB - dateA; 
        }
        const bloqueA = a.bloque || "";
        const bloqueB = b.bloque || "";
        return bloqueA.localeCompare(bloqueB);
    });

    sortedReservas.forEach(res => {
        const tr = document.createElement('tr');
        
        const [year, month, day] = res.fecha.split('-');
        const niceDate = `${day}/${month}/${year}`;
        const sClass = getStatusClass(res.estado);

        tr.innerHTML = `
            <td>${niceDate}</td>
            <td>${res.bloque}</td>
            <td><strong>${escapeHtml(res.profesor)}</strong></td>
            <td>${res.curso}</td>
            <td>${res.asignatura}</td>
            <td><small>${escapeHtml(res.objetivo)}</small></td>
            <td>
                <select class="status-select ${sClass}" data-id="${res.id}">
                    <option value="Pendiente" ${res.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Asistió" ${res.estado === 'Asistió' ? 'selected' : ''}>Asistió</option>
                    <option value="No asistió" ${res.estado === 'No asistió' ? 'selected' : ''}>No asistió</option>
                </select>
            </td>
            <td>
                <button class="btn-danger" data-id="${res.id}" title="Eliminar Reserva" style="padding: 0.4rem 0.8rem; border-radius: 4px; border:none; cursor:pointer; background-color: #e53e3e; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    Eliminar
                </button>
            </td>
        `;

        reservasTbody.appendChild(tr);
    });

    // Delegar estado Firestore
    document.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async function() {
            const documentId = this.dataset.id;
            const newStatus = this.value;
            this.className = `status-select ${getStatusClass(newStatus)}`;
            
            try {
                await updateDoc(doc(db, "reservas", documentId), {
                    estado: newStatus
                });
            } catch(e) {
                console.error("Error cambiando estado:", e);
                alert("Error al guardar estado en la base de datos");
            }
        });
    });

    // Delegar borrado Firestore
    document.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (confirm("¿Estás seguro que deseas eliminar esta reserva de la nube? Este bloque será liberado inmediatamente para los docentes en todo momento.")) {
                try {
                    await deleteDoc(doc(db, "reservas", this.dataset.id));
                } catch(e) {
                    console.error("Error borrando Doc:", e);
                }
            }
        });
    });
}

function renderDocenteDashboard() {
    misReservasTbody.innerHTML = '';
    
    if(!currentDocente) return;
    
    // Filtrar mis reservas
    const misReservas = reservas.filter(r => r.uidDocente === currentDocente.uid || r.profesor === currentDocente.nombre);
    
    if (misReservas.length === 0) {
        noMisReservasMsg.classList.remove('d-none');
        document.querySelector('#docenteView .table-responsive').classList.add('d-none');
        return;
    }

    noMisReservasMsg.classList.add('d-none');
    document.querySelector('#docenteView .table-responsive').classList.remove('d-none');

    const sortedReservas = [...misReservas].sort((a, b) => {
        const dateA = new Date(a.fecha);
        const dateB = new Date(b.fecha);
        // Recientes primero
        if (dateB.getTime() !== dateA.getTime()){
            return dateB - dateA; 
        }
        const bloqueA = a.bloque || "";
        const bloqueB = b.bloque || "";
        return bloqueA.localeCompare(bloqueB);
    });

    const now = new Date();

    sortedReservas.forEach(res => {
        const tr = document.createElement('tr');
        
        const [year, month, day] = res.fecha.split('-');
        const niceDate = `${day}/${month}/${year}`;
        const sClass = getStatusClass(res.estado);
        
        // Logica para deshabilitar botón asistencia
        // Bloque string formato "08:30 a 10:00" - Parseamos inicio (08:30)
        let disableAsistencia = true;
        const matchTime = res.bloque.match(/^(\d{2}):(\d{2})/);
        if(matchTime) {
            const h = parseInt(matchTime[1], 10);
            const m = parseInt(matchTime[2], 10);
            const reserveDate = new Date(`${res.fecha}T00:00:00`);
            reserveDate.setHours(h, m, 0, 0);
            
            // Habilitar solo si ya pasó la fecha/hora de inicio del bloque
            if (now >= reserveDate) {
                disableAsistencia = false;
            }
        }

        tr.innerHTML = `
            <td>${niceDate}</td>
            <td>${res.bloque}</td>
            <td>${res.curso}</td>
            <td>${res.asignatura}</td>
            <td>
                <select class="status-select ${sClass} docente-status" data-id="${res.id}" ${disableAsistencia ? 'disabled title="Disponible solo después de iniciada la clase"' : ''}>
                    <option value="Pendiente" ${res.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Asistió" ${res.estado === 'Asistió' ? 'selected' : ''}>Sí, Asistí</option>
                    <option value="No asistió" ${res.estado === 'No asistió' ? 'selected' : ''}>No pude asistir</option>
                </select>
            </td>
            <td>
                <button class="btn-danger-icon" data-id="${res.id}" title="Eliminar/Cancelar Mi Reserva" style="padding: 0.4rem 0.8rem; border-radius: 4px; border:none; cursor:pointer; background-color: #e53e3e; color: white;">
                    🗑️ Cancelar
                </button>
            </td>
        `;

        misReservasTbody.appendChild(tr);
    });

    // Delegar estado Firestore (Asistencia Docente)
    document.querySelectorAll('.docente-status').forEach(sel => {
        sel.addEventListener('change', async function() {
            const documentId = this.dataset.id;
            const newStatus = this.value;
            this.className = `status-select ${getStatusClass(newStatus)} docente-status`;
            
            try {
                await updateDoc(doc(db, "reservas", documentId), {
                    estado: newStatus
                });
                showToast("Estado actualizado");
            } catch(e) {
                console.error("Error cambiando estado:", e);
                alert("Error al guardar asistencia");
            }
        });
    });

    // Delegar borrado (Cancelar Mi Reserva)
    document.querySelectorAll('#docenteView .btn-danger-icon').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (confirm("¿Seguro que deseas cancelar esta reserva? Liberarás el horario para otros colegas.")) {
                try {
                    await deleteDoc(doc(db, "reservas", this.dataset.id));
                    showToast("Reserva cancelada exitosamente");
                } catch(e) {
                    console.error("Error borrando Doc:", e);
                    alert("No se pudo cancelar la reserva");
                }
            }
        });
    });
}

function handleExportPDF() {
    const start = exportFechaInicio ? exportFechaInicio.value : '';
    const end = exportFechaFin ? exportFechaFin.value : '';
    
    let filteredReservas = reservas;
    let titleContext = "Todos los registros";

    if (start || end) {
        filteredReservas = reservas.filter(r => {
            let startMatch = true;
            let endMatch = true;
            
            if (start) {
                startMatch = r.fecha >= start;
            }
            if (end) {
                endMatch = r.fecha <= end;
            }
            return startMatch && endMatch;
        });

        if (start && end) titleContext = `Del ${start} al ${end}`;
        else if (start) titleContext = `Desde el ${start}`;
        else if (end) titleContext = `Hasta el ${end}`;
    }
    
    if (filteredReservas.length === 0) {
        alert("No hay reservas para el rango seleccionado.");
        return;
    }

    // Sort chrono logic just like in dashboard
    filteredReservas.sort((a, b) => {
        const dateA = new Date(a.fecha);
        const dateB = new Date(b.fecha);
        if (dateB.getTime() !== dateA.getTime()){
            return dateA - dateB; // chronological past to future for reports
        }
        const bloqueA = a.bloque || "";
        const bloqueB = b.bloque || "";
        return bloqueA.localeCompare(bloqueB);
    });

    try {
        const jsPDFConstructor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        
        if (!jsPDFConstructor) {
            throw new Error("La librería de PDFs no se cargó correctamente en este navegador.");
        }

        const doc = new jsPDFConstructor();
        
        doc.setFontSize(18);
        doc.text(`Reporte de Reservas - ${titleContext}`, 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        // Formatear Data para AutoTable
        const tableColumn = ["Fecha", "Bloque", "Profesor", "Curso", "Asignatura", "Estado"];
        const tableRows = [];

        filteredReservas.forEach(r => {
            const [y, m, d] = r.fecha.split('-');
            const niceDate = `${d}/${m}/${y}`;
            const rowData = [
                niceDate,
                r.bloque,
                r.profesor,
                r.curso,
                r.asignatura,
                r.estado
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [10, 102, 194] }
        });

        const safeTitle = titleContext.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Reservas_Metrenco_${safeTitle}.pdf`);
    } catch(err) {
        console.error("Error generating PDF:", err);
        alert("Error técnico al descargar PDF: " + err.message + "\n\nSolución: Presiona la tecla 'F5' o 'Ctrl + F5' para forzar la actualización de esta página en este computador.");
    }
}

function escapeHtml(unsafe) {
    if(!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

init();
