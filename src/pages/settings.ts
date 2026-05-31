const FTP_KEY = 'opencrank:ftp';

export function getFtp(): number {
  return parseInt(localStorage.getItem(FTP_KEY) ?? '200', 10);
}

export function init(container: HTMLElement): void {
  const input = container.querySelector<HTMLInputElement>('#ftpInput')!;
  const saveBtn = container.querySelector<HTMLButtonElement>('#saveFtpBtn')!;

  input.value = String(getFtp());

  saveBtn.addEventListener('click', () => {
    const ftp = parseInt(input.value, 10);
    if (isNaN(ftp) || ftp < 50 || ftp > 600) return;

    localStorage.setItem(FTP_KEY, String(ftp));
    saveBtn.textContent = 'SAVED ✓';
    setTimeout(() => { saveBtn.textContent = 'SAVE'; }, 1500);
  });
}
