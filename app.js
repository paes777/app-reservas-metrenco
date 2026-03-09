import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
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
const db = getFirestore(app);
const reservasRef = collection(db, "reservas");

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

// --- ESTADO INICIAL ---
let reservas = []; // Se poblará desde Firebase Firestore
let isAdminLogged = false;

// --- REFERENCIAS AL DOM ---
const viewDocente = document.getElementById('docenteView');
const viewAdminLogin = document.getElementById('adminLoginView');
const viewAdminDashboard = document.getElementById('adminDashboardView');

const navAdminBtn = document.getElementById('navAdminBtn');
const navDocenteBtn = document.getElementById('navDocenteBtn');

// Formularios Docente
const reservaForm = document.getElementById('reservaForm');
const fieldFecha = document.getElementById('fecha');
const fieldBloque = document.getElementById('bloque');
const btnSubmitReserva = document.getElementById('btnSubmitReserva'); // Button to toggle state

// Auth Admin
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');

// Dashboard Admin
const reservasTbody = document.getElementById('reservasTbody');
const noReservasMsg = document.getElementById('noReservasMsg');

// --- INICIALIZACIÓN ---
function init() {
    setupEventListeners();
    setMinDate();
    listenToFirestore(); // Habilitar escucha en tiempo real
}

function setupEventListeners() {
    // Navegación
    navAdminBtn.addEventListener('click', showAdminLogin);
    navDocenteBtn.addEventListener('click', showDocenteView);
    btnLogout.addEventListener('click', handleLogout);

    // Eventos Formulario Docente
    fieldFecha.addEventListener('change', handleFechaChange);
    reservaForm.addEventListener('submit', handleReservaSubmit);

    // Eventos Admin Login
    loginForm.addEventListener('submit', handleLogin);
}

// --- LOGICA CORE FIREBASE LECTURAS EN TIEMPO REAL ---
function listenToFirestore() {
    // Escucha todos los cambios y sincroniza el array `reservas` global
    const q = query(reservasRef, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        reservas = [];
        snapshot.forEach((docSnap) => {
            reservas.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        // Si estamos en la vista de Admin, refrezcamos la tabla con los nuevos datos
        if (isAdminLogged) {
            renderDashboard();
        }
        
        // Si hay una fecha seleccionada en el formulario del docente, actualizamos su disponibilidad
        if (fieldFecha.value) {
            handleFechaChange();
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- CONTROLADOR DE VISTAS ---
function showDocenteView() {
    viewDocente.classList.add('active');
    viewDocente.classList.remove('d-none');
    viewAdminLogin.classList.remove('active');
    viewAdminLogin.classList.add('d-none');
    viewAdminDashboard.classList.remove('active');
    viewAdminDashboard.classList.add('d-none');
    
    navAdminBtn.classList.remove('d-none');
    navDocenteBtn.classList.add('d-none');
    
    if (fieldFecha.value) {
        handleFechaChange();
    }
}

function showAdminLogin() {
    if (isAdminLogged) {
        showAdminDashboard();
        return;
    }
    viewDocente.classList.remove('active');
    viewDocente.classList.add('d-none');
    viewAdminLogin.classList.add('active');
    viewAdminLogin.classList.remove('d-none');
    viewAdminDashboard.classList.remove('active');
    viewAdminDashboard.classList.add('d-none');
    
    navAdminBtn.classList.add('d-none');
    navDocenteBtn.classList.remove('d-none');
    loginError.classList.add('d-none');
}

function showAdminDashboard() {
    viewDocente.classList.remove('active');
    viewDocente.classList.add('d-none');
    viewAdminLogin.classList.remove('active');
    viewAdminLogin.classList.add('d-none');
    viewAdminDashboard.classList.add('active');
    viewAdminDashboard.classList.remove('d-none');
    
    navAdminBtn.classList.add('d-none');
    navDocenteBtn.classList.remove('d-none');
    
    renderDashboard();
}

// --- LOGICA FORMULARIO DOCENTE ---
function setMinDate() {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().split('T')[0];
    fieldFecha.setAttribute('min', localISOTime);
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
    
    const reservedOnDate = reservas
        .filter(r => r.fecha === dateString)
        .map(r => r.bloque);

    return {
        base: baseBlocks,
        reserved: reservedOnDate
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
        
        if (blocksData.reserved.includes(b)) {
            option.disabled = true;
            option.textContent += " (Ocupado)";
        }
        
        fieldBloque.appendChild(option);
    });

    fieldBloque.disabled = false;

    if (blocksData.reserved.length >= blocksData.base.length) {
        alert("Lo sentimos. Ese día ya tiene todos los bloques horarios reservados.");
        fieldFecha.value = "";
        fieldBloque.innerHTML = '<option value="">Día completamente ocupado...</option>';
        fieldBloque.disabled = true;
    }
}

async function handleReservaSubmit(e) {
    e.preventDefault();

    const profesor = document.getElementById('profesor').value.trim();
    const fecha = fieldFecha.value;
    const bloque = fieldBloque.value;
    const curso = document.getElementById('curso').value;
    const asignatura = document.getElementById('asignatura').value;
    const objetivo = document.getElementById('objetivo').value.trim();

    // Verificación sincrónica antes de envío
    const blocksData = getAvailableBlocks(fecha);
    if (blocksData.reserved.includes(bloque)) {
        alert("Error crítico: El bloque seleccionado acaba de ser reservado. Por favor elija otro.");
        handleFechaChange();
        return;
    }

    // Inhabilitar botón para evitar multi-clicks
    btnSubmitReserva.disabled = true;
    btnSubmitReserva.textContent = "Procesando...";

    try {
        await addDoc(reservasRef, {
            profesor,
            fecha,
            bloque,
            curso,
            asignatura,
            objetivo,
            estado: 'Pendiente', 
            createdAt: serverTimestamp() // Guardado universal en la nube
        });
        
        showToast("Gracias por solicitar la sala de informática");
        
        // Limpiar
        reservaForm.reset();
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

// --- LÓGICA DE ADMINISTRADOR ---
function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (user === 'admin' && pass === 'admin123') {
        isAdminLogged = true;
        loginForm.reset();
        showAdminDashboard();
    } else {
        loginError.classList.remove('d-none');
    }
}

function handleLogout() {
    isAdminLogged = false;
    showDocenteView();
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
        return a.bloque.localeCompare(b.bloque);
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
                <button class="btn-danger-icon" data-id="${res.id}" title="Eliminar Reserva">
                    &#128465; Borrar
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
    document.querySelectorAll('.btn-danger-icon').forEach(btn => {
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
