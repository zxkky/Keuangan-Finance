// Menu mobile
const toggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
if (toggle && sidebar) {
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('hidden') === false;
    sidebar.classList.toggle('flex', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// Dialog formulir. Tombol: data-open="idDialog" [data-action="/url"] [data-json='{"field":"nilai"}']
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open]');
  if (opener) {
    const dlg = document.getElementById(opener.dataset.open);
    const form = dlg.querySelector('form');
    if (form.dataset.defaultAction === undefined) form.dataset.defaultAction = form.getAttribute('action');
    form.reset();
    form.setAttribute('action', opener.dataset.action || form.dataset.defaultAction);
    if (opener.dataset.json) {
      const data = JSON.parse(opener.dataset.json);
      Object.entries(data).forEach(([k, val]) => {
        const el = form.elements[k];
        if (el) el.value = val === null || val === undefined ? '' : val;
      });
    }
    dlg.querySelectorAll('[data-edit-title]').forEach((t) => {
      t.textContent = opener.dataset.json ? t.dataset.editTitle : t.dataset.newTitle;
    });
    dlg.showModal();
    return;
  }
  const closer = e.target.closest('[data-close]');
  if (closer) closer.closest('dialog').close();
});

// Klik di luar dialog menutupnya
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// Konfirmasi sebelum aksi yang menghapus
document.addEventListener('submit', (e) => {
  const msg = e.target.dataset.confirm;
  if (msg && !window.confirm(msg)) e.preventDefault();
});
