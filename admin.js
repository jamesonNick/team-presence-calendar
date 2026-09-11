document.addEventListener('DOMContentLoaded', () => {
    initAdminEvents();
});

function initAdminEvents() {
    const btnAddEmp = document.getElementById('btn-add-emp');
    if (btnAddEmp) btnAddEmp.onclick = showAddEmployeeModal;

    const btnAddHol = document.getElementById('btn-add-holiday');
    if (btnAddHol) btnAddHol.onclick = showAddHolidayModal;

    const btnBulk = document.getElementById('btn-bulk-edit');
    if (btnBulk) btnBulk.onclick = showBulkEditorModal;

    const calendarBody = document.getElementById('calendar-body');
    if (calendarBody) {
        calendarBody.addEventListener('click', handleTableClick);
    }
}

// Global Event Handler for Dynamic Rows & Cells
function handleTableClick(e) {
    const target = e.target;

    // Edit Employee Button
    if (target.classList.contains('btn-edit-emp')) {
        e.stopPropagation();
        const empId = target.getAttribute('data-id');
        const emp = state.employees.find(item => item.id === empId);
        if (emp) showEditEmployeeModal(emp);
        return;
    }

    // Deactivate Employee Button
    if (target.classList.contains('btn-del-emp')) {
        e.stopPropagation();
        const empId = target.getAttribute('data-id');
        const emp = state.employees.find(item => item.id === empId);
        if (emp) showDeactivateEmployeePrompt(emp);
        return;
    }

    // Clickable Cell Schedule Editor
    const cell = target.closest('td.schedule-cell');
    if (cell) {
        const tr = cell.parentElement;
        const rowIndex = Array.from(tr.parentElement.children).indexOf(tr);
        const emp = state.employees[rowIndex];
        
        if (emp) {
            const dayIdx = Array.from(tr.children).indexOf(cell) - (window.location.pathname.includes('admin.html') ? 3 : 2);
            if (dayIdx >= 0) {
                const year = state.currentDate.getFullYear();
                const month = state.currentDate.getMonth();
                const dateObj = new Date(Date.UTC(year, month, dayIdx + 1));
                const dateStr = dateObj.toISOString().split('T')[0];
                showInlineCellEditor(emp, dateStr, cell.innerText.trim());
            }
        }
    }
}

function getTeamOptionsHTML(selectedTeam = '') {
    const teamsSet = new Set(window.PREDEFINED_TEAMS.concat(state.employees.map(e => e.team)));
    return Array.from(teamsSet).map(t => `<option value="${t}" ${t === selectedTeam ? 'selected' : ''}>${t}</option>`).join('');
}

// Cell Schedule Inline Editor
function showInlineCellEditor(emp, dateStr, currentVal) {
    const root = document.getElementById('admin-modal-root');
    
    const optionsHTML = `
        <option value="" ${currentVal === '' ? 'selected' : ''}>-- BLANK / CLEAR SCHEDULE --</option>
        ${window.SCHEDULE_TYPES.map(t => `<option value="${t}" ${t === currentVal ? 'selected' : ''}>${t}</option>`).join('')}
    `;

    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header"><h3>Update Schedule Entry</h3></div>
                <div class="modal-body">
                    <p><strong>Employee:</strong> ${emp.employee_name}</p>
                    <p><strong>Date:</strong> ${dateStr}</p>
                    <div class="form-group">
                        <label>Schedule Type</label>
                        <select id="cell-type-select">
                            ${optionsHTML}
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('admin-modal-root').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-cell">Save</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-save-cell').onclick = async () => {
        const selectedType = document.getElementById('cell-type-select').value;

        let res;
        if (selectedType === '') {
            res = await window.supabaseClient.from('schedules').delete().eq('employee_id', emp.id).eq('schedule_date', dateStr);
        } else {
            res = await window.supabaseClient.from('schedules').upsert({
                employee_id: emp.id,
                schedule_date: dateStr,
                schedule_type: selectedType
            }, { onConflict: 'employee_id,schedule_date' });
        }

        if (res.error) {
            Toast.error('Save failed: ' + res.error.message);
        } else {
            Toast.success('Schedule successfully updated.');
            root.innerHTML = '';
            await loadCalendarData();
        }
    };
}

// Add New Employee Modal
function showAddEmployeeModal() {
    const root = document.getElementById('admin-modal-root');
    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header"><h3>Add New Employee</h3></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Employee Name</label>
                        <input type="text" id="new-emp-name" placeholder="Lastname, Firstname">
                    </div>
                    <div class="form-group">
                        <label>Team</label>
                        <select id="new-emp-team">
                            ${getTeamOptionsHTML()}
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('admin-modal-root').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-emp">Add Employee</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-save-emp').onclick = async () => {
        const name = document.getElementById('new-emp-name').value.trim();
        const team = document.getElementById('new-emp-team').value;

        if (!name || !team) return Toast.warning('Name and Team are required.');

        const exists = state.employees.some(e => e.employee_name.toLowerCase() === name.toLowerCase());
        if (exists) return Toast.warning(`Employee "${name}" already exists.`);

        const { error } = await window.supabaseClient.from('employees').insert({ employee_name: name, team: team });
        if (error) {
            Toast.error('Insert failed: ' + error.message);
        } else {
            Toast.success('Employee successfully added.');
            root.innerHTML = '';
            await loadCalendarData();
        }
    };
}

// Edit Employee Details
function showEditEmployeeModal(emp) {
    const root = document.getElementById('admin-modal-root');
    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header"><h3>Edit Employee</h3></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Employee Name</label>
                        <input type="text" id="edit-emp-name" value="${emp.employee_name}">
                    </div>
                    <div class="form-group">
                        <label>Team</label>
                        <select id="edit-emp-team">
                            ${getTeamOptionsHTML(emp.team)}
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-danger" id="btn-deactivate-emp">Deactivate</button>
                    <button class="btn btn-secondary" onclick="document.getElementById('admin-modal-root').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" id="btn-update-emp">Update</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-update-emp').onclick = async () => {
        const name = document.getElementById('edit-emp-name').value.trim();
        const team = document.getElementById('edit-emp-team').value;

        if (!name || !team) return Toast.warning('Name and Team are required.');

        const { error } = await window.supabaseClient.from('employees').update({ employee_name: name, team: team }).eq('id', emp.id);
        if (error) {
            Toast.error('Update failed: ' + error.message);
        } else {
            Toast.success('Employee successfully updated.');
            root.innerHTML = '';
            await loadCalendarData();
        }
    };

    document.getElementById('btn-deactivate-emp').onclick = () => {
        showDeactivateEmployeePrompt(emp);
    };
}

// Deactivate Employee
function showDeactivateEmployeePrompt(emp) {
    if (confirm(`Are you sure you want to deactivate ${emp.employee_name}?`)) {
        (async () => {
            const { error } = await window.supabaseClient.from('employees').update({ active: false }).eq('id', emp.id);
            if (error) {
                Toast.error('Deactivation failed: ' + error.message);
            } else {
                Toast.success('Employee successfully deactivated.');
                document.getElementById('admin-modal-root').innerHTML = '';
                await loadCalendarData();
            }
        })();
    }
}

// Manage Holidays Modal
function showAddHolidayModal() {
    const root = document.getElementById('admin-modal-root');
    
    const existingHolidaysHTML = state.holidays.length > 0 
        ? state.holidays.map(h => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f0f0f0;">
                <span><strong>${h.holiday_date}</strong> - ${h.holiday_name}</span>
                <button class="btn btn-danger btn-del-holiday-now" data-date="${h.holiday_date}" style="padding:4px 8px; font-size:12px;">Delete</button>
            </div>
        `).join('')
        : '<p style="color:#888; font-size:13px;">No official holidays set for this view.</p>';

    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card" style="max-width: 480px;">
                <div class="modal-header"><h3>Manage Official Holidays (PH)</h3></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Quick Select PH Holiday</label>
                        <select id="ph-holiday-select">
                            <option value="">-- Choose PH Holiday --</option>
                            <option value='{"name": "New Year&#39;s Day", "date": "2026-01-01"}'>New Year's Day (Jan 1)</option>
                            <option value='{"name": "Chinese New Year", "date": "2026-02-17"}'>Chinese New Year (Feb 17)</option>
                            <option value='{"name": "EDSA People Power Revolution", "date": "2026-02-25"}'>EDSA People Power (Feb 25)</option>
                            <option value='{"name": "Maundy Thursday", "date": "2026-04-02"}'>Maundy Thursday (Apr 2)</option>
                            <option value='{"name": "Good Friday", "date": "2026-04-03"}'>Good Friday (Apr 3)</option>
                            <option value='{"name": "Black Saturday", "date": "2026-04-04"}'>Black Saturday (Apr 4)</option>
                            <option value='{"name": "Araw ng Kagitingan", "date": "2026-04-09"}'>Araw ng Kagitingan (Apr 9)</option>
                            <option value='{"name": "Labor Day", "date": "2026-05-01"}'>Labor Day (May 1)</option>
                            <option value='{"name": "Independence Day", "date": "2026-06-12"}'>Independence Day (Jun 12)</option>
                            <option value='{"name": "Ninoy Aquino Day", "date": "2026-08-21"}'>Ninoy Aquino Day (Aug 21)</option>
                            <option value='{"name": "National Heroes Day", "date": "2026-08-31"}'>National Heroes Day (Aug 31)</option>
                            <option value='{"name": "All Saints&#39; Day", "date": "2026-11-01"}'>All Saints' Day (Nov 1)</option>
                            <option value='{"name": "All Souls&#39; Day", "date": "2026-11-02"}'>All Souls' Day (Nov 2)</option>
                            <option value='{"name": "Bonifacio Day", "date": "2026-11-30"}'>Bonifacio Day (Nov 30)</option>
                            <option value='{"name": "Feast of the Immaculate Conception", "date": "2026-12-08"}'>Feast of the Immaculate Conception (Dec 8)</option>
                            <option value='{"name": "Christmas Eve", "date": "2026-12-24"}'>Christmas Eve (Dec 24)</option>
                            <option value='{"name": "Christmas Day", "date": "2026-12-25"}'>Christmas Day (Dec 25)</option>
                            <option value='{"name": "Rizal Day", "date": "2026-12-30"}'>Rizal Day (Dec 30)</option>
                            <option value='{"name": "Last Day of the Year", "date": "2026-12-31"}'>Last Day of the Year (Dec 31)</option>
                            <option value="custom">-- Custom / Uncaptured Holiday --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Holiday Name</label>
                        <input type="text" id="hol-name" placeholder="e.g. Special Non-Working Day">
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="hol-date">
                    </div>
                    <hr style="border:0; border-top:1px solid #e2e8f0; margin:15px 0;">
                    <div class="form-group">
                        <label>Existing Holidays in System</label>
                        <div style="max-height: 140px; overflow-y: auto; background:#fafafa; border:1px solid #eee; padding:8px; border-radius:4px;">
                            ${existingHolidaysHTML}
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('admin-modal-root').innerHTML=''">Close</button>
                    <button class="btn btn-primary" id="btn-save-hol">Save Holiday</button>
                </div>
            </div>
        </div>
    `;

    const dropdown = document.getElementById('ph-holiday-select');
    dropdown.onchange = () => {
        const val = dropdown.value;
        if (val && val !== 'custom') {
            const parsed = JSON.parse(val);
            document.getElementById('hol-name').value = parsed.name;
            document.getElementById('hol-date').value = parsed.date;
        } else if (val === 'custom') {
            document.getElementById('hol-name').value = '';
            document.getElementById('hol-date').value = '';
        }
    };

    // Direct Instant Delete Listener
    document.querySelectorAll('.btn-del-holiday-now').forEach(btn => {
        btn.onclick = async (e) => {
            e.preventDefault();
            const dateStr = btn.getAttribute('data-date');

            btn.disabled = true;
            btn.innerText = 'Deleting...';

            const { error } = await window.supabaseClient.from('holidays').delete().eq('holiday_date', dateStr);

            if (error) {
                Toast.error('Delete failed: ' + error.message);
                btn.disabled = false;
                btn.innerText = 'Delete';
            } else {
                Toast.success('Holiday deleted successfully!');
                root.innerHTML = '';
                await loadCalendarData();
            }
        };
    });

    document.getElementById('btn-save-hol').onclick = async () => {
        const name = document.getElementById('hol-name').value.trim();
        const date = document.getElementById('hol-date').value;

        if (!name || !date) return Toast.warning('Name and Date are required.');

        const { error } = await window.supabaseClient.from('holidays').upsert({ holiday_date: date, holiday_name: name }, { onConflict: 'holiday_date' });
        if (error) Toast.error('Failed to save holiday: ' + error.message);
        else {
            Toast.success('Holiday successfully saved.');
            root.innerHTML = '';
            await loadCalendarData();
        }
    };
}

// Bulk Editor Modal
function showBulkEditorModal() {
    const root = document.getElementById('admin-modal-root');
    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header"><h3>Bulk Schedule Editor</h3></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Scope</label>
                        <select id="bulk-scope">
                            <option value="MONTH">FULL MONTH</option>
                            <option value="RANGE">DATE RANGE</option>
                        </select>
                    </div>
                    <div id="bulk-range-inputs" style="display:none;" class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="bulk-start">
                        <label>End Date</label>
                        <input type="date" id="bulk-end">
                    </div>
                    <div class="form-group">
                        <label>Target Employee</label>
                        <select id="bulk-emp-select">
                            <option value="ALL">ALL EMPLOYEES</option>
                            ${state.employees.map(e => `<option value="${e.id}">${e.employee_name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Schedule Type</label>
                        <select id="bulk-type">
                            <option value="">-- BLANK / CLEAR SCHEDULE --</option>
                            ${window.SCHEDULE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="bulk-exclude-weekends" checked>
                            Exclude Weekends (Saturday & Sunday)
                        </label>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('admin-modal-root').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" id="btn-preview-bulk">Preview Changes</button>
                </div>
            </div>
        </div>
    `;

    const scopeSelect = document.getElementById('bulk-scope');
    scopeSelect.onchange = () => {
        document.getElementById('bulk-range-inputs').style.display = scopeSelect.value === 'RANGE' ? 'flex' : 'none';
    };

    document.getElementById('btn-preview-bulk').onclick = async () => {
        const scope = scopeSelect.value;
        const empId = document.getElementById('bulk-emp-select').value;
        const schedType = document.getElementById('bulk-type').value;
        const excludeWeekends = document.getElementById('bulk-exclude-weekends').checked;

        let dates = [];
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        if (scope === 'MONTH') {
            const totalDays = new Date(year, month + 1, 0).getDate();
            for (let d = 1; d <= totalDays; d++) {
                const dateObj = new Date(Date.UTC(year, month, d));
                const dayOfWeek = dateObj.getUTCDay();
                if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
                dates.push(dateObj.toISOString().split('T')[0]);
            }
        } else {
            const startStr = document.getElementById('bulk-start').value;
            const endStr = document.getElementById('bulk-end').value;
            if (!startStr || !endStr) return Toast.warning('Start and End dates required.');
            
            let curr = new Date(startStr);
            const end = new Date(endStr);
            while (curr <= end) {
                const dayOfWeek = curr.getUTCDay();
                if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
                    dates.push(curr.toISOString().split('T')[0]);
                }
                curr.setDate(curr.getDate() + 1);
            }
        }

        if (dates.length === 0) return Toast.warning('No valid dates selected matching criteria.');

        const targetEmps = empId === 'ALL' ? state.employees : state.employees.filter(e => e.id === empId);

        let errorOccurred = false;
        if (schedType === '') {
            const empIds = targetEmps.map(e => e.id);
            const { error } = await window.supabaseClient.from('schedules').delete().in('employee_id', empIds).in('schedule_date', dates);
            if (error) errorOccurred = error.message;
        } else {
            const payload = [];
            targetEmps.forEach(e => {
                dates.forEach(d => {
                    payload.push({ employee_id: e.id, schedule_date: d, schedule_type: schedType });
                });
            });

            const { error } = await window.supabaseClient.from('schedules').upsert(payload, { onConflict: 'employee_id,schedule_date' });
            if (error) errorOccurred = error.message;
        }

        if (errorOccurred) {
            Toast.error('Bulk update failed: ' + errorOccurred);
        } else {
            Toast.success('Schedule successfully updated.');
            root.innerHTML = '';
            await loadCalendarData();
        }
    };
}
