// Reusable Toast Notifications
const Toast = {
    container: null,
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    show(message, type = 'info') {
        this.init();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); }
};

// Reusable Confirmation Modal
const Modal = {
    confirm({ title, message, onConfirm }) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <div class="modal-header"><h3>${title}</h3></div>
                <div class="modal-body"><p>${message}</p></div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="btn btn-primary" id="modal-ok">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
        overlay.querySelector('#modal-ok').onclick = async () => {
            overlay.remove();
            await onConfirm();
        };
    }
};