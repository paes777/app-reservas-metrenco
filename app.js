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
  appId: "1:432254277949:web:aad45cf2b7d3f504110d54",
  storageBucket: "truftruf-reservas-app.firebasestorage.app",
  apiKey: "AIzaSyAwv9rJ5oyPHLkrw6g1Z9iVWf2mHiQ_S6s",
  authDomain: "truftruf-reservas-app.firebaseapp.com",
  messagingSenderId: "432254277949"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const reservasRef = collection(db, "reservas");

// --- CONSTANTES ---
const BLOCKS_ALL = [
    "09:00 a 09:45",
    "09:45 a 10:30",
    "10:45 a 11:30",
    "11:30 a 12:15",
    "12:30 a 13:15",
    "13:15 a 14:00",
    "14:00 a 14:45",
    "14:45 a 15:30",
    "15:30 a 16:00"
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
const bloquesContainer = document.getElementById('bloques-container');
const fieldProfesor = document.getElementById('profesor');
const btnSubmitReserva = document.getElementById('btnSubmitReserva');
const lblTeacherName = document.getElementById('lblTeacherName');
const recursoSelect = document.getElementById('recurso');
const tabletQuantityContainer = document.getElementById('tabletQuantityContainer');
const tabletQuantityInput = document.getElementById('tabletQuantity');
const filterAdminRecurso = document.getElementById('filterAdminRecurso');
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
    setDateConstraints();
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

    // Eventos Recurso Tech
    if (recursoSelect) {
        recursoSelect.addEventListener('change', () => {
            if (recursoSelect.value === 'Tablets') {
                tabletQuantityContainer.classList.remove('d-none');
                tabletQuantityInput.required = true;
            } else {
                tabletQuantityContainer.classList.add('d-none');
                tabletQuantityInput.required = false;
                tabletQuantityInput.value = '';
            }
        });
    }

    if (filterAdminRecurso) {
        filterAdminRecurso.addEventListener('change', renderDashboard);
    }

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
        
        // Si hay un docente logeado, refrezcar su tabla "Mis Reservas"
        if (currentDocenteUser) {
            renderMyReservas();
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
    const confirmPass = document.getElementById('docentePassConfirmReg').value;
    
    if (pass !== confirmPass) {
        docenteRegError.textContent = "Las contraseñas no coinciden.";
        docenteRegError.classList.remove('d-none');
        return;
    }
    
    if (!/^\d{6}$/.test(pass)) {
        docenteRegError.textContent = "La contraseña debe ser de exactamente 6 números.";
        docenteRegError.classList.remove('d-none');
        return;
    }

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
        
        // Forzar actualización de la UI porque onAuthStateChanged se disparó ANTES de que el perfil se actualizara
        lblTeacherName.textContent = name;
        fieldProfesor.value = name;
        
        // El listener onAuthStateChanged redirigirá automáticamente a la vista principal
        docenteRegisterForm.reset();
    } catch (error) {
        console.error("Error registro:", error);
        if (error.code === 'auth/email-already-in-use') {
            docenteRegError.textContent = "Ese usuario ya existe.";
        } else if (error.code === 'auth/operation-not-allowed') {
            docenteRegError.textContent = "Error: El inicio de sesión con Correo/Contraseña NO ha sido habilitado en la consola de Firebase.";
        } else {
            docenteRegError.textContent = `Error: ${error.message}`;
        }
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
    
    if (!/^\d{6}$/.test(pass)) {
        docenteLoginError.textContent = "La contraseña debe ser de exactamente 6 números.";
        docenteLoginError.classList.remove('d-none');
        return;
    }

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
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            docenteLoginError.textContent = "Usuario o contraseña incorrectos.";
        } else if (error.code === 'auth/operation-not-allowed') {
            docenteLoginError.textContent = "Error: La autenticación no está habilitada en la consola de Firebase.";
        } else {
            docenteLoginError.textContent = `Error: ${error.message}`;
        }
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
function setDateConstraints() {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday... 5 is Friday
    const hours = today.getHours();
    
    let minDate = new Date(today);
    let maxDate = new Date(today);

    // Si es Viernes después de las 14:00, Sábado o Domingo -> Se reserva para la PRÓXIMA semana
    if (day === 6 || day === 0 || (day === 5 && hours >= 14)) {
        let daysToMonday = 0;
        if (day === 5) daysToMonday = 3; // Viernes + 3 = Lunes
        if (day === 6) daysToMonday = 2; // Sabado + 2 = Lunes
        if (day === 0) daysToMonday = 1; // Domingo + 1 = Lunes

        minDate.setDate(today.getDate() + daysToMonday);
        maxDate = new Date(minDate);
        maxDate.setDate(minDate.getDate() + 4); // Lunes + 4 = Viernes
    } 
    // Si es Lunes, Martes, Miércoles, Jueves, o Viernes (antes de las 14:00) -> Se reserva para ESTA misma semana
    else {
        // minDate ya es 'today'
        let daysToThisFriday = 5 - day; // Ej: Si es Lunes(1), faltan 4 dias para el Viernes
        maxDate.setDate(today.getDate() + daysToThisFriday);
    }

    const tzOffset = today.getTimezoneOffset() * 60000;
    const minISO = (new Date(minDate.getTime() - tzOffset)).toISOString().split('T')[0];
    const maxISO = (new Date(maxDate.getTime() - tzOffset)).toISOString().split('T')[0];

    fieldFecha.setAttribute('min', minISO);
    fieldFecha.setAttribute('max', maxISO);
    
    // Asegurar que el formulario siempre sea visible porque el sistema nunca "cierra", solo avanza.
    reservaForm.classList.remove('d-none');
    
    // Si existiese el mensaje antiguo, lo aseguramos oculto
    const bookingClosedMsg = document.getElementById('bookingClosedMsg');
    if (bookingClosedMsg) bookingClosedMsg.classList.add('d-none');
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
    const baseBlocks = [...BLOCKS_ALL];
    
    const reservedOnDateMap = {};
    reservas
        .filter(r => r.fecha === dateString)
        .forEach(r => {
            // Si hay bloques combinados (ej. "09:00 a 09:45 y 09:45 a 10:30"), los separamos para bloquear la UI individualmente
            const bloquesSeparados = r.bloque.split(' y ');
            bloquesSeparados.forEach(bol => {
                reservedOnDateMap[bol.trim()] = {
                    profesor: r.profesor || "Profesor(a) no identificado",
                    isReserved: true
                };
            });
        });

    return {
        base: baseBlocks,
        reserved: reservedOnDateMap
    };
}

function handleFechaChange() {
    const fecha = fieldFecha.value;
    
    bloquesContainer.innerHTML = '<em>Seleccione una fecha primero...</em>';

    if (!fecha) return;

    if (isWeekend(fecha)) {
        alert("Atención: Solo se puede reservar la sala de lunes a viernes.");
        fieldFecha.value = "";
        return;
    }

    const blocksData = getAvailableBlocks(fecha);
    bloquesContainer.innerHTML = '';
    
    blocksData.base.forEach((b, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'bloqueSelection';
        checkbox.value = b;
        checkbox.dataset.index = index;
        checkbox.id = `bloque_${index}`;
        
        const label = document.createElement('label');
        label.textContent = b;
        label.setAttribute('for', `bloque_${index}`);
        label.style.cursor = 'pointer';
        label.style.margin = '0';
        
        const info = blocksData.reserved[b];
        if (info && info.isReserved) {
            checkbox.disabled = true;
            label.textContent += ` (Ocupado por ${info.profesor})`;
            label.style.color = '#a0aec0';
            label.style.textDecoration = 'line-through';
        }
        
        checkbox.addEventListener('change', handleCheckboxChange);
        
        div.appendChild(checkbox);
        div.appendChild(label);
        bloquesContainer.appendChild(div);
    });
}

function handleCheckboxChange() {
    const checkboxes = Array.from(document.querySelectorAll('input[name="bloqueSelection"]:checked'));
    
    if (checkboxes.length > 2) {
        alert("Atención: Puede seleccionar un máximo de 2 bloques.");
        this.checked = false;
        return;
    }

    if (checkboxes.length === 2) {
        const index1 = parseInt(checkboxes[0].dataset.index);
        const index2 = parseInt(checkboxes[1].dataset.index);
        
        if (Math.abs(index1 - index2) !== 1) {
            alert("Atención: Los bloques seleccionados deben ser continuos (uno inmediatamente después del otro).");
            this.checked = false;
        }
    }
}

async function handleReservaSubmit(e) {
    e.preventDefault();

    const profesorInput = document.getElementById('profesor').value.trim();
    // Asegurar que el nombre no vaya vacío bajo ninguna circunstancia
    const profesor = profesorInput || "Profesor(a) no identificado";
    
    const fecha = fieldFecha.value;
    
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="bloqueSelection"]:checked'));
    if (checkedBoxes.length === 0) {
        alert("Debe seleccionar al menos un bloque horario.");
        return;
    }

    const bloquesElegidos = checkedBoxes.map(cb => cb.value);
    
    let recurso = document.getElementById('recurso').value;
    if (recurso === 'Tablets') {
        const qty = tabletQuantityInput.value;
        if (qty) recurso = `Tablets (${qty})`;
    }
    
    const curso = document.getElementById('curso').value;
    const asignatura = document.getElementById('asignatura').value;
    const objetivo = document.getElementById('objetivo').value.trim();

    // Verificación sincrónica RIGUROSA antes de envío
    const blocksData = getAvailableBlocks(fecha);
    for (let bol of bloquesElegidos) {
        if (blocksData.reserved[bol] && blocksData.reserved[bol].isReserved) {
            alert(`Error crítico: El bloque ${bol} ya se encuentra ocupado. No es posible duplicar reservas.`);
            handleFechaChange();
            return;
        }
    }

    // Inhabilitar botón para evitar multi-clicks
    btnSubmitReserva.disabled = true;
    btnSubmitReserva.textContent = "Procesando...";

    try {
        await addDoc(reservasRef, {
            userId: currentDocenteUser ? currentDocenteUser.uid : 'desconocido',
            profesor,
            fecha,
            bloque: bloquesElegidos.join(' y '), // Unifica 2 bloques continuos en UNA Sola Cadena
            recurso,
            curso,
            asignatura,
            objetivo,
            estado: 'Pendiente', 
            createdAt: serverTimestamp() // Guardado universal en la nube
        });
        
        showToast(`Gracias por solicitar la sala de informática`);
        
        // Limpiar
        reservaForm.reset();
        
        // Repoblar el nombre si hay sesión iniciada
        if (currentDocenteUser) {
            fieldProfesor.value = currentDocenteUser.displayName || currentDocenteUser.email.split('@')[0];
        }
        
        bloquesContainer.innerHTML = '<em>Seleccione una fecha primero...</em>';
    } catch(err) {
        console.error("Error al guardar reserva: ", err);
        alert("Ha ocurrido un error de conexión al enviar. Verifique su internet y reintente.");
    } finally {
        btnSubmitReserva.disabled = false;
        btnSubmitReserva.textContent = "Enviar Solicitud";
    }
}

// --- LOGICA MIS RESERVAS (DOCENTE) ---
function isPastTime(fechaStr, bloqueStr) {
    if (!fechaStr || !bloqueStr) return false;
    const startTimeStr = bloqueStr.split(' a ')[0]; // Extrae "08:30"
    const targetDate = new Date(`${fechaStr}T${startTimeStr}:00`);
    const now = new Date();
    return now >= targetDate;
}

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

        const isTablet = (res.recurso || '').startsWith('Tablets');
        const optAsistio = isTablet ? 'Las utilizó' : 'Asistió';
        const optNoAsistio = isTablet ? 'No utilizó el recurso' : 'No asistió';

        tr.innerHTML = `
            <td>${niceDate}</td>
            <td>${res.bloque}</td>
            <td>${res.recurso || 'Sala de Informática'}</td>
            <td>${res.asignatura}</td>
            <td>
                <select class="status-select ${sClass}" data-id="${res.id}" style="width:100%;">
                    <option value="Pendiente" ${res.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="${optAsistio}" ${res.estado === optAsistio ? 'selected' : ''}>${optAsistio}</option>
                    <option value="${optNoAsistio}" ${res.estado === optNoAsistio ? 'selected' : ''}>${optNoAsistio}</option>
                </select>
            </td>
            <td>
                <button class="btn-danger-icon btn-delete-my-reserva" data-id="${res.id}" title="Eliminar Reserva" style="border:none; cursor:pointer;">
                    ✖ Quitar
                </button>
            </td>
        `;

        myReservasTbody.appendChild(tr);
    });

    // Eventos para actualizar Estado (Solo Docente)
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async function() {
            const newStatus = this.value;
            const resId = this.dataset.id;
            
            // Validacion de tiempo
            const reserva = reservas.find(r => r.id === resId);
            if (newStatus !== 'Pendiente' && reserva && !isPastTime(reserva.fecha, reserva.bloque)) {
                alert("Restricción: No puede marcar su asistencia (Asistió o No asistió) antes de que la clase haya comenzado.");
                // Revert dropdown (Mantener estado anterior)
                this.value = reserva.estado;
                return;
            }

            // UI Optimitics Update (Color)
            this.className = `status-select ${getStatusClass(newStatus)}`;
            
            try {
                await updateDoc(doc(db, "reservas", resId), {
                    estado: newStatus
                });
            } catch(e) {
                console.error("Error actualizando estado:", e);
                alert("Hubo un problema de conexión al guardar el nuevo estado. Verifique su internet.");
            }
        });
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
    if (statusStr === 'Asistió' || statusStr === 'Las utilizó') return 'status-Asistio';
    if (statusStr === 'No asistió' || statusStr === 'No utilizó el recurso') return 'status-NoAsistio';
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

    // Filtrado por Recurso
    let reservasFiltradas = reservas;
    if (filterAdminRecurso && filterAdminRecurso.value !== 'Todos') {
        const selected = filterAdminRecurso.value;
        reservasFiltradas = reservasFiltradas.filter(r => {
            const actualRecurso = r.recurso || 'Sala de Informática';
            if (selected === 'Tablets') {
                return actualRecurso.startsWith('Tablets');
            }
            return actualRecurso === selected;
        });
    }

    if (reservasFiltradas.length === 0) {
        noReservasMsg.classList.remove('d-none');
        document.querySelector('.table-responsive').classList.add('d-none');
        return;
    }

    const sortedReservas = [...reservasFiltradas].sort((a, b) => {
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

        const isTablet = (res.recurso || '').startsWith('Tablets');
        const optAsistio = isTablet ? 'Las utilizó' : 'Asistió';
        const optNoAsistio = isTablet ? 'No utilizó el recurso' : 'No asistió';

        tr.innerHTML = `
            <td>${niceDate}</td>
            <td>${res.bloque}</td>
            <td>${res.recurso || 'Sala de Informática'}</td>
            <td><strong>${escapeHtml(res.profesor)}</strong></td>
            <td>${res.curso}</td>
            <td>${res.asignatura}</td>
            <td><small>${escapeHtml(res.objetivo)}</small></td>
            <td>
                <select class="status-select ${sClass}" data-id="${res.id}">
                    <option value="Pendiente" ${res.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="${optAsistio}" ${res.estado === optAsistio ? 'selected' : ''}>${optAsistio}</option>
                    <option value="${optNoAsistio}" ${res.estado === optNoAsistio ? 'selected' : ''}>${optNoAsistio}</option>
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
        const tableColumn = ["Fecha", "Bloque", "Recurso", "Profesor", "Curso", "Asignatura", "Estado"];
        const tableRows = [];

        filteredReservas.forEach(r => {
            const [y, m, d] = r.fecha.split('-');
            const niceDate = `${d}/${m}/${y}`;
            const rowData = [
                niceDate,
                r.bloque,
                r.recurso || 'Sala de Informática',
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
