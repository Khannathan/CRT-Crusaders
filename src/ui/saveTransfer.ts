import { PAL, hex } from '../config';
import { autoBackups, exportSave, importSave, type SaveData } from '../state/save';

/**
 * Save backup as a plain HTML panel over the game, since copying, pasting and
 * picking files need real text boxes. Export shows the save code (copy it or
 * download it as a file); import takes a pasted code or a chosen file.
 */

function panel(title: string): { root: HTMLDivElement; box: HTMLDivElement; close: () => void } {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(9,6,11,.9);display:flex;align-items:center;justify-content:center;padding:16px;';
  const box = document.createElement('div');
  box.style.cssText = `width:min(480px,100%);background:#241925;border:2px solid ${hex(PAL.bronze)};padding:18px;color:${hex(PAL.ivory)};font-family:Georgia,serif;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;`;
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = `font-size:24px;color:${hex(PAL.amber)};text-align:center;`;
  box.appendChild(h);
  root.appendChild(box);
  document.body.appendChild(root);
  const close = () => root.remove();
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  return { root, box, close };
}

function note(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = `font-size:15px;color:${hex(PAL.steel)};text-align:center;line-height:1.35;`;
  return d;
}

function button(label: string, onClick: () => void, main = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `flex:1;min-height:48px;font:17px Georgia,serif;cursor:pointer;border:2px solid ${hex(PAL.bronze)};background:${main ? '#5a2a2a' : '#1a1218'};color:${hex(main ? PAL.amber : PAL.ivory)};`;
  b.addEventListener('click', onClick);
  return b;
}

function row(...items: HTMLElement[]): HTMLDivElement {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;gap:10px;';
  items.forEach((i) => r.appendChild(i));
  return r;
}

function area(value = ''): HTMLTextAreaElement {
  const t = document.createElement('textarea');
  t.value = value;
  t.rows = 6;
  t.spellcheck = false;
  t.style.cssText = 'width:100%;box-sizing:border-box;font:12px monospace;background:#0c0709;color:#e8dcc4;border:1px solid #5a4a3a;padding:8px;resize:none;word-break:break-all;';
  return t;
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Shows the save code with Copy and Download. */
export function showExport(save: SaveData) {
  const code = exportSave(save);
  const { box, close } = panel('Back up your save');
  box.appendChild(note('Copy this code or download the file, and keep it safe. Restore it on any device to continue.'));
  const t = area(code);
  t.readOnly = true;
  box.appendChild(t);
  const status = note('');
  const copy = button('Copy code', async () => {
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = 'Copied.';
    } catch {
      t.select();
      status.textContent = 'Select the code above and copy it.';
    }
  }, true);
  const download = button('Download file', () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `crt-crusaders-save-${stamp()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Saved to your downloads.';
  });
  box.appendChild(row(copy, download));
  box.appendChild(status);
  box.appendChild(row(button('Done', close)));
}

/** Takes a pasted code or a file; on a valid save asks once, then calls onLoad. */
export function showImport(onLoad: (save: SaveData) => void) {
  const { box, close } = panel('Restore a save');
  box.appendChild(note('Paste a save code, or choose a save file. This replaces the progress on this device.'));
  const t = area();
  t.placeholder = 'CRT1.…';
  box.appendChild(t);
  const status = note('');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.txt,.json,text/plain,application/json';
  file.style.display = 'none';
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) t.value = await f.text();
    check();
  });
  box.appendChild(file);
  let armed: SaveData | undefined;
  const load = button('Restore', () => {
    if (!armed) return check();
    onLoad(armed);
    close();
  }, true);
  const check = () => {
    armed = undefined;
    load.textContent = 'Restore';
    if (!t.value.trim()) {
      status.textContent = 'Paste a code or choose a file first.';
      return;
    }
    const s = importSave(t.value);
    if (!s) {
      status.textContent = 'That is not a save from this game.';
      status.style.color = '#d65f5f';
      return;
    }
    armed = s;
    status.style.color = hex(PAL.steel);
    status.textContent = `Found a save with ${Object.keys(s.owned).length} Sisters, ${s.seals} Seals and ${s.tithes} Tithes. Tap again to replace this device's progress.`;
    load.textContent = 'Replace my progress';
  };
  t.addEventListener('input', () => {
    armed = undefined;
    load.textContent = 'Restore';
    status.textContent = '';
  });
  box.appendChild(row(button('Choose file', () => file.click()), load));
  box.appendChild(status);
  // This device's own daily backups: one tap to arm, a second to restore.
  const autos = autoBackups();
  if (autos.length) {
    box.appendChild(note('Or roll back to a daily backup kept on this device:'));
    for (const a of autos) {
      const label = `${a.day} · ${Object.keys(a.save.owned).length} Sisters · ${a.save.seals} Seals`;
      const b = button(label, () => {
        if (armed === a.save) {
          onLoad(a.save);
          close();
          return;
        }
        armed = a.save;
        status.style.color = hex(PAL.steel);
        status.textContent = `The backup from ${a.day}. Tap it again to replace this device's progress.`;
        load.textContent = 'Restore';
      });
      box.appendChild(row(b));
    }
  }
  box.appendChild(row(button('Cancel', close)));
}
