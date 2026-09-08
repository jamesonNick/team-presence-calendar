document.addEventListener('DOMContentLoaded', () => {
    const btnAddEmp = document.getElementById('btn-add-emp');
    if (btnAddEmp) btnAddEmp.onclick = showAddEmployeeModal;

    const btnAddHol = document.getElementById('btn-add-holiday');
    if (btnAddHol) btnAddHol.onclick = showAddHolidayModal;

    const btnBulk = document.getElementById('btn-bulk-edit');
    if (btnBulk) btnBulk.onclick = showBulkEditorModal;
});

// Overriding Cell Generation for Admin Interaction & Action Buttons
const originalRenderGrid = renderGrid;
renderGrid = function() {
    originalRenderGrid();
    
    // Action Buttons Event Binding per Row
    document.querySelectorAll('.btn-edit-emp').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const empId = btn.getAttribute('data-id');
            const emp = state.employees.find(e => e.id === empId);
            if (emp) showEditEmployeeModal(emp);
        };
    });

    document.querySelectorAll('.btn-del-emp').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const empId = btn.getAttribute('data-id');
            const emp = state.employees.find(e => e.id === empId);
            if (emp) showDeactivateEmployeePrompt(emp);
        };
    });

    // Clickable Interactive Cells
    const rows = document.querySelectorAll('#calendar-body tr');
    rows.forEach((tr, index) => {
        const emp = state.employees[index];
        if (!emp) return;

        const cells = tr.querySelectorAll('td.schedule-cell');
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        cells.forEach((td, dayIdx) => {
            td.onclick = () => {
                const dateObj = new Date(Date.UTC(year, month, dayIdx + 1));
                const dateStr = dateObj.toISOString().split('T')[0];
                showInlineCellEditor(emp, dateStr, td.innerText);
            };
        });
    });
};

function getTeamOptionsHTML(selectedTeam = '') {
    const teamsSet = new Set(PREDEFINED_TEAMS.concat(state.employees.map(e => e.team)));
    return Array.from(teamsSet).map(t => `<option value="${t}" ${t === selectedTeam ? 'selected' : ''}>${t}</option>`).join('');
}

function showInlineCellEditor(emp, dateStr, currentVal) {
    const root = document.getElementById('admin-modal-root');
    
    // Support CLEAR / BLANK option
    const optionsHTML = `
        <option value="" ${currentVal === '' ? 'selected' : ''}>-- BLANK / CLEAR SCHEDULE --</option>
        ${SCHEDULE_TYPES.map(t => `<option value="${t}" ${t === currentVal ? 'selected' : ''}>${t}</option>`).join('')}
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
        const actionText = selectedType === '' ? 'Clear schedule entry' : `Change schedule to "${selectedType}"`;

        Modal.confirm({
            title: 'Confirm Schedule Change',
            message: `${actionText} for ${emp.employee_name} on ${dateStr}?`,
            onConfirm: async () => {
                let res;
                if (selectedType === '') {
                    res = await supabaseClient
                        .from('schedules')
                        .delete()
                        .eq('employee_id', emp.id)
                        .eq('schedule_date', dateStr);
                } else {
                    res = await supabaseClient.from('schedules').upsert({
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
            }
        });
    };
}

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

        // Client-side check to prevent adding duplicates
        const exists = state.employees.some(e => e.employee_name.toLowerCase() === name.toLowerCase());
        if (exists) {
            return Toast.warning(`Employee "${name}" already exists.`);
        }

        const { error } = await supabaseClient.from('employees').insert({ employee_name: name, team: team });
        if (error) {
            Toast.error('Insert failed: ' + error.message);
        } else {
            Toast.success('Employee successfully added.');
            root.innerHTML = '';
            await loadCalendarData();
        }
    };
}

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

        // Client-side check for duplicate name when updating to another existing name
        const duplicate = state.employees.some(e => e.id !== emp.id && e.employee_name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            return Toast.warning(`Another employee with name "${name}" already exists.`);
        }

        Modal.confirm({
            title: 'Confirm Update',
            message: `Update details for ${emp.employee_name}?`,
            onConfirm: async () => {
                const { error } = await supabaseClient.from('employees').update({ employee_name: name, team: team }).eq('id', emp.id);
                if (error) Toast.error('Update failed: ' + error.message);
                else {
                    Toast.success('Employee successfully updated.');
                    root.innerHTML = '';
                    await loadCalendarData();
                }
            }
        });
    };

    document.getElementById('btn-deactivate-emp').onclick = () => {
        showDeactivateEmployeePrompt(emp);
    };
}

function showDeactivateEmployeePrompt(emp) {
    const root = document.getElementById('admin-modal-root');
    Modal.confirm({
        title: 'Confirm Deactivation',
        message: `Are you sure you want to deactivate ${emp.employee_name}? Historical schedule data will be retained.`,
        onConfirm: async () => {
            const { error } = await supabaseClient.from('employees').update({ active: false }).eq('id', emp.id);
            if (error) Toast.error('Deactivation failed: ' + error.message);
            else {
                Toast.success('Employee successfully deactivated.');
                root.innerHTML = '';
                await loadCalendarData();
            }
        }
    });
}

function showAddHolidayModal() {
    const root = document.getElementById('admin-modal-root');
    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <div class="modal-header"><h3>Add Official Holiday</h3></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Holiday Name</label>
                        <input type="text" id="hol-name" placeholder="e.g. Independence Day">
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="hol-date">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('admin-modal-root').innerHTML=''">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-hol">Add Holiday</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-save-hol').onclick = async () => {
        const name = document.getElementById('hol-name').value.trim();
        const date = document.getElementById('hol-date').value;

        if (!name || !date) return Toast.warning('Name and Date are required.');

        Modal.confirm({
            title: 'Confirm Holiday',
            message: `Add ${name} on ${date}?`,
            onConfirm: async () => {
                const { error } = await supabaseClient.from('holidays').insert({ holiday_date: date, holiday_name: name });
                if (error) Toast.error('Failed to add holiday: ' + error.message);
                else {
                    Toast.success('Holiday successfully added.');
                    root.innerHTML = '';
                    await loadCalendarData();
                }
            }
        });
    };
}

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
                            ${SCHEDULE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
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

    document.getElementById('btn-preview-bulk').onclick = () => {
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
                if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
                    continue;
                }
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

        if (dates.length === 0) {
            return Toast.warning('No valid dates selected matching criteria.');
        }

        const targetEmps = empId === 'ALL' ? state.employees : state.employees.filter(e => e.id === empId);
        const totalRecords = targetEmps.length * dates.length;
        const actionDesc = schedType === '' ? 'CLEAR / ERASE' : `set to "${schedType}"`;

        Modal.confirm({
            title: 'Confirm Bulk Assignment',
            message: `You are about to ${actionDesc} ${totalRecords} schedule records (${excludeWeekends ? 'excluding weekends' : 'including weekends'}). Apply changes?`,
            onConfirm: async () => {
                let errorOccurred = false;

                if (schedType === '') {
                    const empIds = targetEmps.map(e => e.id);
                    const { error } = await supabaseClient
                        .from('schedules')
                        .delete()
                        .in('employee_id', empIds)
                        .in('schedule_date', dates);
                    
                    if (error) errorOccurred = error.message;
                } else {
                    const payload = [];
                    targetEmps.forEach(e => {
                        dates.forEach(d => {
                            payload.push({ employee_id: e.id, schedule_date: d, schedule_type: schedType });
                        });
                    });

                    const { error } = await supabaseClient.from('schedules').upsert(payload, { onConflict: 'employee_id,schedule_date' });
                    if (error) errorOccurred = error.message;
                }

                if (errorOccurred) Toast.error('Bulk update failed: ' + errorOccurred);
                else {
                    Toast.success('Schedule successfully updated.');
                    root.innerHTML = '';
                    await loadCalendarData();
                }
            }
        });
    };
}
