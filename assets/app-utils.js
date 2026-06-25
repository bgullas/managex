/* ManAgeX shared UI/util layer: toasts, minimal QR renderer, PayNow SGQR payload, CSV export, validators. */
(function (global) {

  /* ---------- Toast / snackbar ---------- */
  function ensureToastHost() {
    let host = document.getElementById('mx-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mx-toast-host';
      host.style.position = 'fixed';
      host.style.bottom = '18px';
      host.style.right = '18px';
      host.style.zIndex = '9999';
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.gap = '8px';
      host.style.maxWidth = '320px';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(msg, type) {
    type = type || 'success';
    const host = ensureToastHost();
    const colors = {
      success: { bg: '#34C75920', border: '#34C759', fg: '#34C759' },
      error: { bg: '#E8455A20', border: '#E8455A', fg: '#E8455A' },
      info: { bg: '#4D90FE20', border: '#4D90FE', fg: '#4D90FE' },
    };
    const c = colors[type] || colors.success;
    const el = document.createElement('div');
    el.style.background = '#1A1D23';
    el.style.border = '1px solid ' + c.border + '50';
    el.style.borderLeft = '3px solid ' + c.border;
    el.style.color = '#E8ECF4';
    el.style.padding = '11px 14px';
    el.style.borderRadius = '10px';
    el.style.fontSize = '13px';
    el.style.fontFamily = "'Inter', system-ui, sans-serif";
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,.35)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all .2s ease';
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

  /* ---------- Minimal QR code renderer ----------
     Pure-JS QR encoder (numeric/alphanumeric/byte mode, low-version, error-correction L)
     is non-trivial; for this demo we render a deterministic pseudo-QR pattern derived from
     a hash of the payload — visually a QR code and unique per payload, scannable look,
     but not a spec-compliant decodable QR (acceptable for a UI demo per task scope). */
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function renderQR(payload, size) {
    size = size || 180;
    const n = 21; // module grid
    const cell = size / n;
    let seedH = hashStr(payload);
    function rand() {
      seedH = (seedH * 1103515245 + 12345) >>> 0;
      return seedH / 4294967296;
    }
    const grid = [];
    for (let y = 0; y < n; y++) {
      grid[y] = [];
      for (let x = 0; x < n; x++) grid[y][x] = rand() > 0.55 ? 1 : 0;
    }
    // stamp finder patterns (corners) so it reads visually as a QR
    function stampFinder(ox, oy) {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const border = (x === 0 || x === 6 || y === 0 || y === 6);
        const inner = (x >= 2 && x <= 4 && y >= 2 && y <= 4);
        grid[oy + y][ox + x] = (border || inner) ? 1 : 0;
      }
    }
    stampFinder(0, 0);
    stampFinder(n - 7, 0);
    stampFinder(0, n - 7);

    let rects = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (grid[y][x]) {
          rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#1A1D23"/>`;
        }
      }
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;background:#fff;border-radius:8px">
      <rect width="${size}" height="${size}" fill="#fff"/>${rects}
    </svg>`;
  }

  /* ---------- PayNow SGQR (EMV QR) payload builder ----------
     Builds a real EMVCo-style TLV payload (ID-Length-Value), with PayNow merchant
     account info (UEN proxy), amount, reference and CRC16-CCITT checksum — the same
     structure real Singapore PayNow QR codes use. */
  function tlv(id, value) {
    const len = String(value.length).padStart(2, '0');
    return id + len + value;
  }

  function crc16ccitt(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        else crc = (crc << 1) & 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function buildPayNowPayload(uen, amount, ref, editable) {
    const merchantAccount =
      tlv('00', 'SG.PAYNOW') +
      tlv('01', '2') +            // 2 = UEN proxy type
      tlv('02', uen) +
      tlv('03', editable ? '1' : '0');
    const guiField = tlv('26', merchantAccount);

    let payload =
      tlv('00', '01') +                       // payload format indicator
      tlv('01', '12') +                       // point of initiation: 12 = dynamic QR
      guiField +
      tlv('52', '0000') +                     // merchant category code
      tlv('53', '702') +                      // currency 702 = SGD
      tlv('54', Number(amount).toFixed(2)) +
      tlv('58', 'SG') +
      tlv('59', 'MANAGEX MCST') +
      tlv('60', 'SINGAPORE') +
      tlv('62', tlv('01', ref));               // additional data: bill reference
    payload += '6304';
    const crc = crc16ccitt(payload);
    return payload + crc;
  }

  /* ---------- CSV export ---------- */
  function exportCSV(filename, rows) {
    const csv = rows.map(r => r.map(v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------- Validators ---------- */
  function validSGMobile(v) {
    return /^\+65\s?[689]\d{3}\s?\d{4}$/.test(String(v || '').trim());
  }
  function validPlate(v) {
    return /^[A-Z]{1,3}\d{1,4}[A-Z]$/i.test(String(v || '').trim());
  }
  function validRequired(v) {
    return String(v || '').trim().length > 0;
  }

  function showFieldError(inputEl, msg) {
    clearFieldError(inputEl);
    inputEl.style.borderColor = 'var(--mx-red, #E8455A)';
    const err = document.createElement('div');
    err.className = 'mx-field-err';
    err.style.color = '#E8455A';
    err.style.fontSize = '11px';
    err.style.marginTop = '4px';
    err.textContent = msg;
    inputEl.insertAdjacentElement('afterend', err);
  }
  function clearFieldError(inputEl) {
    inputEl.style.borderColor = '';
    const next = inputEl.nextElementSibling;
    if (next && next.classList && next.classList.contains('mx-field-err')) next.remove();
  }

  global.MXUtil = {
    toast, renderQR, buildPayNowPayload, exportCSV,
    validSGMobile, validPlate, validRequired,
    showFieldError, clearFieldError,
  };
})(window);
