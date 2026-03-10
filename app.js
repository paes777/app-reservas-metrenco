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
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// --- CONFIGURACIÓN FIREBASE FIRESTORE ---
const firebaseConfig = {
  projectId: "truftruf-reservas-app",
  appId: "1:330048122396:web:aad45cf2b7d3f504110d54",
  storageBucket: "truftruf-reservas-app.firebasestorage.app",
  apiKey: "AIzaSyDEy2G6-9D09WzE_6PZ7s4rB-fKVN77949",
  authDomain: "truftruf-reservas-app.firebaseapp.com",
  messagingSenderId: "330048122396"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
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
let currentDocenteUser = null; // Usuario docente activo

// --- REFERENCIAS AL DOM ---
const viewDocenteAuth = document.getElementById('docenteAuthView');
const viewDocente = document.getElementById('docenteView');
const viewAdminLogin = document.getElementById('adminLoginView');
const viewAdminDashboard = document.getElementById('adminDashboardView');

const navAdminBtn = document.getElementById('navAdminBtn');
const navDocenteBtn = document.getElementById('navDocenteBtn');

// Formularios Docente Principal
const reservaForm = document.getElementById('reservaForm');
const fieldFecha = document.getElementById('fecha');
const fieldBloque = document.getElementById('bloque');
const fieldProfesor = document.getElementById('profesor');
const btnSubmitReserva = document.getElementById('btnSubmitReserva');
const lblTeacherName = document.getElementById('lblTeacherName');
const btnDocenteLogout = document.getElementById('btnDocenteLogout');
const myReservasTbody = document.getElementById('myReservasTbody');
const noMyReservasMsg = document.getElementById('noMyReservasMsg');

// Formularios Docente Auth
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const docenteLoginForm = document.getElementById('docenteLoginForm');
const docenteRegisterForm = document.getElementById('docenteRegisterForm');
const docenteLoginError = document.getElementById('docenteLoginError');
const docenteRegError = document.getElementById('docenteRegError');

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

// --- INICIALIZACIÓN ---
function init() {
    listenToAuthChanges(); // Manejar sesión docente
    setupEventListeners();
    setMinDate();
    listenToFirestore(); // Habilitar escucha en tiempo real
}

function listenToAuthChanges() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuario está loggeado
            currentDocenteUser = user;
            lblTeacherName.textContent = user.displayName || user.email.split('@')[0];
            fieldProfesor.value = user.displayName || user.email.split('@')[0];
            showDocenteDashboard();
            renderMyReservas();
        } else {
            // No hay usuario loggeado
            currentDocenteUser = null;
            lblTeacherName.textContent = "";
            fieldProfesor.value = "";
            showDocenteAuth();
        }
    });
}

function setupEventListeners() {
    // Navegación
    navAdminBtn.addEventListener('click', showAdminLogin);
    navDocenteBtn.addEventListener('click', () => {
        if (currentDocenteUser) showDocenteDashboard();
        else showDocenteAuth();
    });
    btnLogout.addEventListener('click', handleLogout);

    // Eventos Docente Auth (Navegación TABS)
    tabLogin.addEventListener('click', () => {
        tabLogin.style.color = "var(--primary-color)";
        tabLogin.style.borderBottom = "2px solid var(--primary-color)";
        tabRegister.style.color = "var(--text-muted)";
        tabRegister.style.borderBottom = "none";
        docenteLoginForm.classList.remove('d-none');
        docenteRegisterForm.classList.add('d-none');
        docenteLoginError.classList.add('d-none');
        docenteRegError.classList.add('d-none');
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.style.color = "var(--primary-color)";
        tabRegister.style.borderBottom = "2px solid var(--primary-color)";
        tabLogin.style.color = "var(--text-muted)";
        tabLogin.style.borderBottom = "none";
        docenteRegisterForm.classList.remove('d-none');
        docenteLoginForm.classList.add('d-none');
        docenteLoginError.classList.add('d-none');
        docenteRegError.classList.add('d-none');
    });

    // Eventos Formularios Docente Auth
    docenteLoginForm.addEventListener('submit', handleDocenteLogin);
    docenteRegisterForm.addEventListener('submit', handleDocenteRegister);
    btnDocenteLogout.addEventListener('click', handleDocenteLogout);

    // Eventos Formulario Docente Reservas
    fieldFecha.addEventListener('change', handleFechaChange);
    reservaForm.addEventListener('submit', handleReservaSubmit);

    // Eventos Admin Login
    loginForm.addEventListener('submit', handleLogin);

    // Eventos Dashboard
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', handleExportPDF);
    }
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
function showDocenteAuth() {
    viewDocenteAuth.classList.remove('d-none');
    viewDocenteAuth.classList.add('active');
    viewDocente.classList.add('d-none');
    viewDocente.classList.remove('active');
    
    viewAdminLogin.classList.remove('active');
    viewAdminLogin.classList.add('d-none');
    viewAdminDashboard.classList.remove('active');
    viewAdminDashboard.classList.add('d-none');
    
    navAdminBtn.classList.remove('d-none');
    navDocenteBtn.classList.add('d-none');
}

function showDocenteDashboard() {
    viewDocenteAuth.classList.add('d-none');
    viewDocenteAuth.classList.remove('active');
    viewDocente.classList.remove('d-none');
    viewDocente.classList.add('active');
    
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
    viewDocenteAuth.classList.add('d-none');
    viewDocenteAuth.classList.remove('active');
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
    viewDocenteAuth.classList.add('d-none');
    viewDocenteAuth.classList.remove('active');
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

// --- LOGICA AUTH DOCENTES ---
async function handleDocenteRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('btnDocenteReg');
    const name = document.getElementById('docenteNameReg').value.trim();
    const user = document.getElementById('docenteUserReg').value.trim().toLowerCase();
    const pass = document.getElementById('docentePassReg').value;
    
    const email = `${user}@truftruf.cl`;

    btn.disabled = true;
    btn.textContent = "Procesando...";
    docenteRegError.classList.add('d-none');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        // Actualizar el perfil con el nombre
        await updateProfile(userCredential.user, {
            displayName: name
        });
        
        // El listener onAuthStateChanged redirigirá automáticamente a la vista principal
        docenteRegisterForm.reset();
    } catch (error) {
        console.error("Error registro:", error);
        docenteRegError.textContent = error.code === 'auth/email-already-in-use' 
            ? "Ese usuario ya existe." 
            : "Hubo un error al registrarse. Revise los datos.";
        docenteRegError.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.textContent = "Crear Cuenta";
    }
}

async function handleDocenteLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnDocenteLogin');
    const user = document.getElementById('docenteUserLogin').value.trim().toLowerCase();
    const pass = document.getElementById('docentePassLogin').value;
    
    const email = `${user}@truftruf.cl`;

    btn.disabled = true;
    btn.textContent = "Verificando...";
    docenteLoginError.classList.add('d-none');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // El listener onAuthStateChanged redirigirá automáticamente
        docenteLoginForm.reset();
    } catch (error) {
        console.error("Error login:", error);
        docenteLoginError.textContent = "Usuario o contraseña incorrectos.";
        docenteLoginError.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.textContent = "Ingresar";
    }
}

async function handleDocenteLogout() {
    try {
        await signOut(auth);
    } catch(err) {
        console.error("Error al salir:", err);
    }
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
            userId: currentDocenteUser ? currentDocenteUser.uid : 'desconocido',
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

// --- LOGICA MIS RESERVAS (DOCENTE) ---
function renderMyReservas() {
    myReservasTbody.innerHTML = '';
    
    if (!currentDocenteUser) return;
    
    // Filtrar solo las reservas del profesor autenticado
    const myReservas = reservas.filter(r => r.userId === currentDocenteUser.uid);
    
    if (myReservas.length === 0) {
        noMyReservasMsg.classList.remove('d-none');
        document.querySelector('.my-reservas-table').parentElement.classList.add('d-none');
        return;
    }

    noMyReservasMsg.classList.add('d-none');
    document.querySelector('.my-reservas-table').parentElement.classList.remove('d-none');

    // Ordenar mis reservas
    const sortedReservas = [...myReservas].sort((a, b) => {
        const dateA = new Date(a.fecha);
        const dateB = new Date(b.fecha);
        if (dateB.getTime() !== dateA.getTime()){
            return dateA - dateB; // Mostrar más proximas primero
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
            <td>${res.asignatura}</td>
            <td><span class="${sClass}" style="padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.85rem; font-weight: 500;">${res.estado}</span></td>
            <td>
                <button class="btn-danger-icon btn-delete-my-reserva" data-id="${res.id}" title="Eliminar Reserva" style="border:none; cursor:pointer;">
                    ✖ Quitar
                </button>
            </td>
        `;

        myReservasTbody.appendChild(tr);
    });

    // Delegar borrado (Solo Docente)
    document.querySelectorAll('.btn-delete-my-reserva').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (confirm("¿Estás seguro que deseas quitar esta solicitud? El bloque volverá a estar disponible.")) {
                try {
                    await deleteDoc(doc(db, "reservas", this.dataset.id));
                } catch(e) {
                    console.error("Error borrando Mi Reserva:", e);
                    alert("No se pudo eliminar la reserva. Verifique su conexión.");
                }
            }
        });
    });
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
        return a.bloque.localeCompare(b.bloque);
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
            headStyles: { fillColor: [177, 199, 137] }
        });

        const safeTitle = titleContext.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Reservas_Truf_Truf_${safeTitle}.pdf`);
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
