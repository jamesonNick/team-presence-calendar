// State Management
const state = {
    currentDate: new Date(),
    employees: [],
    schedules: [],
    holidays: [],
    teams: new Set(),
    filters: { search: '', team: 'ALL' }
};

// Helper function to safely format local YYYY-MM-DD (Prevents UTC timezone rollback)
function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    setupMonthYearSelectors();
    setupEventListeners();
    await loadCalendarData();
});

function setupMonthYearSelectors() {
    const monthSelect = document.getElementById('filter-month');
    const yearSelect = document.getElementById('filter-year');
    if (!monthSelect || !yearSelect) return;
    
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    monthSelect.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    
    const currYear = state.currentDate.getFullYear();
    yearSelect.innerHTML = [currYear - 1, currYear, currYear + 1].map(y => `<option value="${y}">${y}</option>`).join('');
    
    syncSelectsWithState();
}

function syncSelectsWithState() {
    const mSelect = document.getElementById('filter-month');
    const ySelect = document.getElementById('filter-year');
    if (mSelect) mSelect.value = state.currentDate.getMonth();
    if (ySelect) ySelect.value = state.currentDate.getFullYear();
}

function setupEventListeners() {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            renderGrid();
        });
    }
    
    const teamSelect = document.getElementById('filter-team');
    if (teamSelect) {
        teamSelect.addEventListener('change', (e) => {
            state.filters.team = e.target.value;
            renderGrid();
        });
    }

    const monthSelect = document.getElementById('filter-month');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            state.currentDate.setMonth(parseInt(e.target.value));
            loadCalendarData();
        });
    }

    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            state.currentDate.setFullYear(parseInt(e.target.value));
            loadCalendarData();
        });
    }

    const btnPrev = document.getElementById('btn-prev-month');
    if (btnPrev) {
        btnPrev.onclick = () => {
            state.currentDate.setMonth(state.currentDate.getMonth() - 1);
            syncSelectsWithState();
            loadCalendarData();
        };
    }

    const btnCurr = document.getElementById('btn-curr-month');
    if (btnCurr) {
        btnCurr.onclick = () => {
            state.currentDate = new Date();
            syncSelectsWithState();
            loadCalendarData();
        };
    }

    const btnNext = document.getElementById('btn-next-month');
    if (btnNext) {
        btnNext.onclick = () => {
            state.currentDate.setMonth(state.currentDate.getMonth() + 1);
            syncSelectsWithState();
            loadCalendarData();
        };
    }

    // KPI Modal Click Handlers
    const kpiTotal = document.getElementById('kpi-total');
    if (kpiTotal) kpiTotal.onclick = () => showKPIModal('TOTAL');
    
    const kpiWfh = document.getElementById('kpi-wfh');
    if (kpiWfh) kpiWfh.onclick = () => showKPIModal('WFH');
    
    const kpiWfo = document.getElementById('kpi-wfo');
    if (kpiWfo) kpiWfo.onclick = () => showKPIModal('WFO');
    
    const kpiLeave = document.getElementById('kpi-leave');
    if (kpiLeave) kpiLeave.onclick = () => showKPIModal('LEAVE');
    
    const kpiHoliday = document.getElementById('kpi-holiday');
    if (kpiHoliday) kpiHoliday.onclick = () => showKPIModal('HOLIDAY');
}

async function loadCalendarData() {
    try {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        
        // Local start and end date formatting
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Batch Data Fetching
        const [empRes, schedRes, holRes] = await Promise.all([
            supabaseClient.from('employees').select('*').eq('active', true).order('employee_name'),
            supabaseClient.from('schedules').select('*').gte('schedule_date', startDate).lte('schedule_date', endDate),
            supabaseClient.from('holidays').select('*').gte('holiday_date', startDate).lte('holiday_date', endDate)
        ]);

        if (empRes.error) throw empRes.error;
        if (schedRes.error) throw schedRes.error;
        if (holRes.error) throw holRes.error;

        state.employees = empRes.data;
        state.schedules = schedRes.data;
        state.holidays = holRes.data;

        // Dynamic Team Populator
        state.teams = new Set(PREDEFINED_TEAMS.concat(state.employees.map(e => e.team)));
        const teamSelect = document.getElementById('filter-team');
        if (teamSelect) {
            const currentTeam = state.filters.team;
            teamSelect.innerHTML = '<option value="ALL">All Teams</option>' + 
                Array.from(state.teams).map(t => `<option value="${t}">${t}</option>`).join('');
            teamSelect.value = currentTeam;
        }

        calculateKPIs();
        renderGrid();
    } catch (err) {
        Toast.error('Failed to load schedule data: ' + err.message);
    }
}

function calculateKPIs() {
    const todayStr = getLocalDateString();
    
    const valTotal = document.getElementById('val-total');
    if (valTotal) valTotal.innerText = state.employees.length;
    
    // BINAGO DITO: Kumuha ng listahan ng Active Employee IDs para siguradong active employees lang ang mabibilang sa KPI
    const activeEmpIds = new Set(state.employees.map(e => e.id));
    const todayScheds = state.schedules.filter(s => s.schedule_date === todayStr && activeEmpIds.has(s.employee_id));
    
    const valWfh = document.getElementById('val-wfh');
    if (valWfh) valWfh.innerText = todayScheds.filter(s => s.schedule_type === 'WFH').length;
    
    const valWfo = document.getElementById('val-wfo');
    if (valWfo) valWfo.innerText = todayScheds.filter(s => s.schedule_type === 'WFO').length;
    
    const valLeave = document.getElementById('val-leave');
    if (valLeave) valLeave.innerText = todayScheds.filter(s => LEAVE_TYPES.includes(s.schedule_type)).length;
    
    const valHoliday = document.getElementById('val-holiday');
    if (valHoliday) valHoliday.innerText = state.holidays.length;
}

function renderGrid() {
    const headerRow = document.getElementById('calendar-header');
    const tbody = document.getElementById('calendar-body');
    if (!headerRow || !tbody) return;
    
    headerRow.innerHTML = '';
    tbody.innerHTML = '';

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateString();

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Headers
    let headerHTML = `
        <th class="col-sticky-1">EMPLOYEE NAME</th>
        <th class="col-sticky-2">TEAM</th>
    `;
    
    // If admin page, add sticky Actions column header
    const isAdmin = window.location.pathname.includes('admin.html');
    if (isAdmin) {
        headerHTML += `<th class="col-sticky-actions">ACTIONS</th>`;
    }

    headerRow.innerHTML = headerHTML;

    const holidayMap = new Map(state.holidays.map(h => [h.holiday_date, h.holiday_name]));

    for (let day = 1; day <= totalDays; day++) {
        const dateObj = new Date(year, month, day);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeekIdx = dateObj.getDay();
        const dayName = daysOfWeek[dayOfWeekIdx];
        const isWeekend = (dayOfWeekIdx === 0 || dayOfWeekIdx === 6);
        const isHoliday = holidayMap.has(dateStr);
        const isToday = (dateStr === todayStr);

        const th = document.createElement('th');
        const monthShort = dateObj.toLocaleString('default', { month: 'short' });
        
        th.innerHTML = `
            <div class="header-day">${dayName}</div>
            <div class="header-date">${String(day).padStart(2, '0')}-${monthShort}</div>
        `;
        
        if (isWeekend) th.classList.add('cell-weekend');
        if (isHoliday) {
            th.classList.add('cell-holiday-hdr');
            th.title = holidayMap.get(dateStr);
        }
        if (isToday) {
            th.classList.add('cell-today');
            th.title = 'Today';
        }
        headerRow.appendChild(th);
    }

    // Filter Employees
    const filteredEmps = state.employees.filter(emp => {
        const matchName = emp.employee_name.toLowerCase().includes(state.filters.search);
        const matchTeam = state.filters.team === 'ALL' || emp.team === state.filters.team;
        return matchName && matchTeam;
    });

    // Schedule Lookups
    const scheduleMap = new Map();
    state.schedules.forEach(s => scheduleMap.set(`${s.employee_id}_${s.schedule_date}`, s.schedule_type));

    // Rows
    filteredEmps.forEach(emp => {
        const tr = document.createElement('tr');
        
        let rowHTML = `
            <td class="col-sticky-1">${emp.employee_name}</td>
            <td class="col-sticky-2">${emp.team}</td>
        `;

        if (isAdmin) {
            rowHTML += `
                <td class="col-sticky-actions">
                    <div class="action-cell-btns">
                        <button class="btn btn-sm btn-primary btn-edit-emp" data-id="${emp.id}">Edit</button>
                        <button class="btn btn-sm btn-danger btn-del-emp" data-id="${emp.id}">Deact</button>
                    </div>
                </td>
            `;
        }

        tr.innerHTML = rowHTML;

        for (let day = 1; day <= totalDays; day++) {
            const dateObj = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeekIdx = dateObj.getDay();
            const isWeekend = (dayOfWeekIdx === 0 || dayOfWeekIdx === 6);
            const isToday = (dateStr === todayStr);
            
            const schedType = scheduleMap.get(`${emp.id}_${dateStr}`) || '';
            const td = document.createElement('td');
            td.innerText = schedType;
            td.className = 'schedule-cell';

            if (isWeekend) td.classList.add('cell-weekend');
            if (isToday) td.classList.add('cell-today-col');

            if (schedType) {
                if (schedType === 'WFH') td.classList.add('schedule-wfh');
                else if (schedType === 'WFO') td.classList.add('schedule-wfo');
                else if (schedType === 'HOLIDAY') td.classList.add('schedule-holiday');
                else if (['VL', 'SL'].includes(schedType)) td.classList.add('schedule-vl');
                else if (schedType.includes('AM') || schedType.includes('PM')) td.classList.add('schedule-half');
            }

            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });
}

function showKPIModal(type) {
    const root = document.getElementById('kpi-modal-root');
    if (!root) return;
    
    const todayStr = getLocalDateString();
    let title = '';
    let contentHtml = '';

    const activeEmpIds = new Set(state.employees.map(e => e.id));

    if (type === 'TOTAL') {
        title = 'All Active Employees';
        contentHtml = state.employees.map(e => `<div><strong>${e.employee_name}</strong> - ${e.team}</div>`).join('');
    } else if (type === 'HOLIDAY') {
        title = 'Monthly Holidays';
        contentHtml = state.holidays.map(h => `<div><strong>${h.holiday_date}</strong>: ${h.holiday_name}</div>`).join('') || 'No holidays this month.';
    } else {
        title = `${type} List (Today: ${todayStr})`;
        // BINAGO DITO: Isinama ang `activeEmpIds.has(s.employee_id)` para sa KPI Modal popup
        const filteredScheds = state.schedules.filter(s => {
            if (s.schedule_date !== todayStr || !activeEmpIds.has(s.employee_id)) return false;
            if (type === 'LEAVE') return LEAVE_TYPES.includes(s.schedule_type);
            return s.schedule_type === type;
        });

        const empMap = new Map(state.employees.map(e => [e.id, e]));
        contentHtml = filteredScheds.map(s => {
            const emp = empMap.get(s.employee_id);
            return emp ? `<div><strong>${emp.employee_name}</strong> (${emp.team}) - <span>${s.schedule_type}</span></div>` : '';
        }).join('') || 'No records found for today.';
    }

    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="btn" onclick="document.getElementById('kpi-modal-root').innerHTML=''">&times;</button>
                </div>
                <div class="modal-body">${contentHtml}</div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('kpi-modal-root').innerHTML=''">Close</button>
                </div>
            </div>
        </div>
    `;
}
