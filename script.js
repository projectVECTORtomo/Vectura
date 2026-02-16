/**
 * Vectura Core Engine v1.1
 * Developed by projectVECTORtomo
 */

const PREFIXES = [
    { name: '-', factor: 1, tex: '', regex: /^$/ },
    { name: 'n (10⁻⁹)', factor: 1e9, tex: '\\text{n}', regex: /^n/ },
    { name: 'μ (10⁻⁶)', factor: 1e6, tex: '\\mu ', regex: /^(u|μ|micro)/ },
    { name: 'm (10⁻³)', factor: 1e3, tex: '\\text{m}', regex: /^m(?!icro)/ },
    { name: 'k (10³)', factor: 1e-3, tex: '\\text{k}', regex: /^k/ },
    { name: 'M (10⁶)', factor: 1e-6, tex: '\\text{M}', regex: /^M/ }
];

const els = {
    input: document.getElementById('inputData'),
    hasHeader: document.getElementById('hasHeader'),
    colControls: document.getElementById('columnControls'),
    sigFigs: document.getElementById('sigFigs'),
    sigFigLabel: document.getElementById('sigFigLabel'),
    split: document.getElementById('splitTable'),
    sci: document.getElementById('scientific'),
    useBooktabs: document.getElementById('useBooktabs'),
    useSiunitx: document.getElementById('useSiunitx'),
    autoResize: document.getElementById('autoResize'),
    caption: document.getElementById('tableCaption'),
    label: document.getElementById('tableLabel'),
    output: document.getElementById('outputCode'),
    preamble: document.getElementById('preambleCode'),
    copy: document.getElementById('copyBtn'),
    toast: document.getElementById('toast'),
    resetBtn: document.getElementById('resetManualBtn'),
};

let columnState = [];

function normalizeText(str) {
    if (!str) return '';
    return str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ').trim();
}

function escapeLatex(str) {
    if (typeof str !== 'string' || str.includes('$') || str.includes('\\')) return str;
    return str.replace(/&/g, '\\&').replace(/%/g, '\\%').replace(/\$/g, '\\$').replace(/#/g, '\\#').replace(/_/g, '\\_').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

// User Requirement: Vector Bold Styling (\mathbf)
function applyVectorFormat(str) {
    let s = normalizeText(str);
    if (!s) return '';
    s = s.replace(/\*(.*?)\*/g, '\\mathbf{$1}');
    if (s.includes('\\') || s.includes('^')) return s.startsWith('$') ? s : `$${s}$`;
    return escapeLatex(s);
}

function parseHeader(headerStr) {
    const h = normalizeText(headerStr);
    const match = h.match(/(.*?)[\(\[](.*?)[\)\]]/);
    if (!match) return { name: applyVectorFormat(h), unit: '', factor: 1, align: 'c', isMath: false };
    const name = applyVectorFormat(match[1]);
    return { name, unit: match[2].trim(), factor: 1, align: 'c', isMath: false };
}

function syncState() {
    const raw = els.input.value.trim();
    if (!raw) {
        els.colControls.innerHTML = `<div class="text-center py-20 text-slate-300 font-bold italic text-base">データを貼り付けてください...</div>`;
        return;
    }
    const lines = raw.split('\n').filter(l => l.trim() !== '');
    const headerLine = lines[0].split('\t');
    const numCols = headerLine.length;
    
    if (columnState.length > numCols) columnState = columnState.slice(0, numCols);
    else if (columnState.length < numCols) {
        for (let i = columnState.length; i < numCols; i++) {
            const parsed = parseHeader((headerLine[i] || `Col ${i+1}`).trim());
            columnState.push({ ...parsed, isManual: false, isMath: false, lastHeader: (headerLine[i] || '').trim() });
        }
    }
    renderControls();
    generate();
}

function renderControls() {
    const html = columnState.map((col, i) => `
        <div class="column-card p-8 rounded-[2rem] ${col.isManual ? 'manual-edit shadow-indigo-100 shadow-xl' : 'auto-detected shadow-md'}">
            <span class="badge ${col.isManual ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'}">${col.isManual ? 'Manual' : 'Sync'}</span>
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Variable</label>
                    <input type="text" value="${col.name}" class="name-input w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all" data-idx="${i}">
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Unit</label>
                    <input type="text" value="${col.unit}" class="unit-input w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs text-indigo-600 font-black focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all" placeholder="V, A..." data-idx="${i}">
                </div>
            </div>
            <div class="grid grid-cols-3 gap-4 items-end">
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Scale</label>
                    <select class="factor-select w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-[10px] outline-none cursor-pointer font-bold text-slate-600" data-idx="${i}">
                        ${PREFIXES.map(p => `<option value="${p.factor}" ${p.factor === col.factor ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center block">Align</label>
                    <div class="flex border-2 border-slate-200 rounded-xl overflow-hidden bg-white mx-auto">
                        <button class="align-btn ${col.align==='l'?'active':''}" data-idx="${i}" data-val="l">L</button>
                        <button class="align-btn border-x-2 border-slate-200 ${col.align==='c'?'active':''}" data-idx="${i}" data-val="c">C</button>
                        <button class="align-btn ${col.align==='r'?'active':''}" data-idx="${i}" data-val="r">R</button>
                    </div>
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center block">Format</label>
                    <label class="flex items-center justify-center gap-3 cursor-pointer bg-slate-50 p-2.5 rounded-xl border-2 border-slate-100 hover:bg-slate-100 transition-all h-[36px]">
                        <input type="checkbox" class="math-toggle w-4 h-4 accent-indigo-600 rounded" data-idx="${i}" ${col.isMath ? 'checked' : ''}>
                        <span class="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Math</span>
                    </label>
                </div>
            </div>
        </div>
    `).join('');
    if (els.colControls.innerHTML !== html) {
        els.colControls.innerHTML = html;
        addEventListeners();
    }
}

function addEventListeners() {
    document.querySelectorAll('.name-input').forEach(el => el.addEventListener('input', e => { columnState[e.target.dataset.idx].name = e.target.value; columnState[e.target.dataset.idx].isManual = true; generate(); }));
    document.querySelectorAll('.unit-input').forEach(el => el.addEventListener('input', e => { columnState[e.target.dataset.idx].unit = e.target.value; columnState[e.target.dataset.idx].isManual = true; generate(); }));
    document.querySelectorAll('.factor-select').forEach(el => el.addEventListener('change', e => { columnState[e.target.dataset.idx].factor = parseFloat(e.target.value); columnState[e.target.dataset.idx].isManual = true; renderControls(); generate(); }));
    document.querySelectorAll('.math-toggle').forEach(el => el.addEventListener('change', e => { columnState[e.target.dataset.idx].isMath = e.target.checked; columnState[e.target.dataset.idx].isManual = true; generate(); }));
    document.querySelectorAll('.align-btn').forEach(el => el.addEventListener('click', e => { columnState[e.target.dataset.idx].align = e.target.dataset.val; columnState[e.target.dataset.idx].isManual = true; renderControls(); generate(); }));
}

function toSmartDecimal(val, precision) {
    let s = val.toPrecision(precision);
    if (!s.includes('e')) return s;
    const absVal = Math.abs(val);
    if (absVal >= 0.00001 && absVal < 1000000) {
        const exponent = Math.floor(Math.log10(absVal));
        const fractionDigits = Math.max(0, precision - 1 - exponent);
        return val.toFixed(fractionDigits);
    }
    return s;
}

function formatValue(valStr, precision, forceSci, factor, isMath, useSiunitx) {
    let raw = normalizeText(valStr);
    if (raw.includes('+-')) {
        const parts = raw.split('+-');
        return `${formatValue(parts[0], precision, forceSci, factor, isMath, useSiunitx)} \\pm ${formatValue(parts[1], precision, forceSci, factor, isMath, useSiunitx)}`;
    }
    let val = parseFloat(raw);
    if (isNaN(val)) return applyVectorFormat(valStr.trim());
    val *= factor;
    if (useSiunitx) return `\\num{${val.toPrecision(precision)}}`;
    const absVal = Math.abs(val);
    if (forceSci || (absVal !== 0 && (absVal < 0.0001 || absVal >= 1000000))) {
        const expStr = val.toExponential(precision - 1);
        const [base, p] = expStr.split('e');
        return `$${parseInt(p) === 0 ? base : `${base} \\times 10^{${parseInt(p)}}`}$`;
    } else {
        let formatted = toSmartDecimal(val, precision);
        if (formatted.includes('e')) {
            const [b, p2] = formatted.split('e');
            return `$${b} \\times 10^{${parseInt(p2)}}$`;
        }
        return isMath ? `$${formatted}$` : formatted;
    }
}

function generate() {
    const raw = els.input.value.trim();
    if (!raw) { els.output.textContent = "% System Ready. Awaiting data..."; return; }
    const lines = raw.split('\n').filter(l => l.trim() !== '');
    const dataRows = els.hasHeader.checked ? lines.slice(1) : lines;
    const precision = parseInt(els.sigFigs.value);
    const forceSci = els.sci.checked;
    const isSplit = els.split.checked;
    const useBooktabs = els.useBooktabs.checked;
    const useSiunitx = els.useSiunitx.checked;
    const autoResize = els.autoResize.checked;
    
    let preamble = "\\usepackage{booktabs}";
    if (autoResize) preamble += "\n\\usepackage{graphicx}";
    if (useSiunitx) preamble += "\n\\usepackage{siunitx}";
    els.preamble.textContent = preamble;

    const headerRow = columnState.map(col => {
        const name = col.name;
        if (!col.unit) return name;
        const p = PREFIXES.find(pf => pf.factor === col.factor);
        let unitStr = p.tex.includes('\\mu') ? `\\mu\\mathrm{${col.unit}}` : `${p.tex}\\mathrm{${col.unit}}`;
        return `${name} [$${unitStr}$]`;
    });
    const processed = dataRows.map(l => {
        const cells = l.split('\t');
        return columnState.map((col, i) => formatValue(cells[i] || '', precision, forceSci, col.factor, col.isMath, useSiunitx));
    });
    const colAligns = columnState.map(c => c.align).join(useBooktabs ? '' : '|');
    let alignStr = useBooktabs ? colAligns : `|${colAligns}|`;
    let latex = `% Project VECTOR - Vectura v1.1\n\\begin{table}[htbp]\n  \\centering\n`;
    latex += `  \\caption{${applyVectorFormat(els.caption.value) || "Experimental Results"}}\n`;
    if (autoResize) latex += `  \\resizebox{\\textwidth}{!}{\n`;
    latex += `  \\begin{tabular}{${alignStr}}\n`;
    const l = { t: useBooktabs ? '    \\toprule' : '    \\hline', m: useBooktabs ? '    \\midrule' : '    \\hline', b: useBooktabs ? '    \\bottomrule' : '    \\hline' };
    latex += `${l.t}\n    ${headerRow.join(' & ')} \\\\ ${l.m}\n`;
    if (isSplit) {
        const mid = Math.ceil(processed.length / 2);
        for (let i = 0; i < mid; i++) {
            const lRow = processed[i].join(' & ');
            const rRow = processed[i+mid] ? processed[i+mid].join(' & ') : Array(columnState.length).fill('-').join(' & ');
            latex += `    ${lRow} & ${rRow} \\\\ \n`;
        }
    } else {
        processed.forEach((row, i) => {
            latex += `    ${row.join(' & ')} \\\\ `;
            if (i === processed.length - 1) latex += `${l.b}\n`; else latex += `\n`;
        });
    }
    latex += `  \\end{tabular}\n`;
    if (autoResize) latex += `  }\n`;
    latex += `  \\label{${normalizeText(els.label.value).replace(/\s+/g, '_') || "tab:results"}}\n\\end{table}`;
    els.output.textContent = latex;
}

// Initial Listeners
els.input.addEventListener('input', syncState);
els.hasHeader.addEventListener('change', syncState);
els.sigFigs.addEventListener('input', e => { els.sigFigLabel.textContent = `${e.target.value} 桁表示`; generate(); });
[els.sci, els.caption, els.label, els.useBooktabs, els.useSiunitx, els.autoResize, els.split].forEach(e => {
    if (e) e.addEventListener('input', generate);
});
els.resetBtn.addEventListener('click', () => { columnState = []; syncState(); });
els.copy.addEventListener('click', () => {
    navigator.clipboard.writeText(els.output.textContent).then(() => {
        els.toast.classList.add('opacity-100', 'translate-y-0');
        setTimeout(() => els.toast.classList.remove('opacity-100', 'translate-y-0'), 1800);
    });
});
window.copyPreamble = () => navigator.clipboard.writeText(els.preamble.textContent);
syncState();