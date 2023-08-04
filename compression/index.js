const stateDefaults = {
    p: 0.001,
    n: 50_000,
};

let state = { ...stateDefaults };

const intFormat = (bits) => new Intl.NumberFormat().format(bits);

const resetState = (e) => {
    state = { ...stateDefaults };

    state.compressedInfo = document.getElementById('compressedInfo');

    const pInput = document.getElementById('p');
    state.p = parseFloat(pInput.value, 10) ?? state.p;
    pInput.value = state.p;
    document.getElementById('pLog').value = Math.log10(state.p);


    const nInput = document.getElementById('n');
    state.n = parseInt(nInput.value, 10) ?? state.n;
    nInput.value = state.n;
    document.getElementById('nLog').value = Math.log10(state.n);

    const elS = document.getElementById('canvasSource');
    const elC = document.getElementById('canvasCompressed');
    const elD = document.getElementById('canvasDecompressed');

    state.canvasS = elS;
    state.canvasC = elC;
    state.canvasD = elD;

    const dpr = window.devicePixelRatio;

    state.w = Math.ceil(Math.min(1 * Math.sqrt(state.n), window.innerWidth / 2.8 / dpr));
    state.h = Math.ceil((state.n) / state.w);

    state.canvasS.width = state.w;
    state.canvasS.style.width = `${state.w * 2}px`;

    state.canvasD.width = state.w;
    state.canvasD.style.width = `${state.w * 2}px`;

    state.canvasS.height = state.h;
    state.canvasS.style.height = `${state.h * 2}px`;

    state.canvasD.height = state.h;
    state.canvasD.style.height = `${state.h * 2}px`;

    state.ctxS = elS.getContext('2d');
    state.ctxC = elC.getContext('2d');
    state.ctxD = elD.getContext('2d');

    onRun();
};

const genSourceSignal = () => {
    state.numOnes = 0;
    const signal = new Uint8Array(state.n);
    for (let i = 0; i < state.n; i++) {
        signal[i] = Math.random() < state.p ? 1 : 0;
        state.numOnes++;
    }

    return signal;
};

const RLE = () => {
    const cMetaBlocks = [];
    state.cMetaBlocks = cMetaBlocks;

    const signal = state.sourceSignal;

    const deltas = [];
    let lastOne = -1;
    for (let i = 0; i < state.n; i++) {
        const s = signal[i];
        if (s === 1) {
            const delta = i - lastOne;
            deltas.push(delta);
            cMetaBlocks.push({
                start: lastOne + 1,
                end: i,
                delta,
            });
            lastOne = i;
        }
    }

    const binaryEncoding = deltas.map(d => {
        const binString = d.toString(2);
        const bin = binString.split('').map(d => d === '1' ? 1 : 0);
        return [new Array(bin.length).fill(0), bin];
    }).flat(2);

    return binaryEncoding;
};

const deRLE = () => {
    const signal = state.compressedSignal;

    const deltas = [];

    let mode = 'length';
    let len = 0;
    let j = 0;
    for (let i = 0; i < signal.length; i++) {
        const s = signal[i];
        // if (i === 0 && s === 1) {
        //     deltas[0] = [0];
        //     len = 0;
        //     j++;
        //     i++;
        //     continue;
        // }

        if (s === 0 && mode === 'length') {
            len++;
            continue;
        }
        if (s === 1 && mode === 'length') {
            mode = 'delta';
        }

        if (!deltas[j]) { deltas[j] = []; }
        deltas[j].push(s);
        len--;
        if (len === 0) {
            mode = 'length';
            j++;
        }
    }

    const decDeltas = deltas.map(d => parseInt(d.join(''), 2))

    const n = state.n;// decDeltas.reduce((acc, d) => acc + d, 0);
    const decompressed = new Uint8Array(n);

    let k = -1;
    for (let i = 0; i < decDeltas.length; i++) {
        k += decDeltas[i];
        decompressed[k] = 1;
    }

    return decompressed;
};

const drawSourceSignal = () => {
    const { canvasS, ctxS } = state;
    ctxS.fillStyle = 'black';
    ctxS.fillRect(0, 0, canvasS.width, canvasS.height);
    const sourceW = canvasS.width;
    ctxS.fillStyle = 'white';
    for (let i = 0; i < state.n; i++) {
        const w = i % sourceW;
        const h = Math.floor(i / sourceW);
        if (state.sourceSignal[i]) {
            ctxS.fillRect(w, h, 1, 1);
        }
    }

    ctxS.fillStyle = 'white';
    ctxS.fillRect(state.n % sourceW, canvasS.height - 1, sourceW, 1);
};

const drawDecompressedSignal = () => {
    const { canvasD, ctxD, decompressedSignal } = state;
    ctxD.fillStyle = 'black';
    ctxD.fillRect(0, 0, canvasD.width, canvasD.height);
    const decW = canvasD.width;
    ctxD.fillStyle = 'white';
    for (let i = 0; i < decompressedSignal.length; i++) {
        const w = i % decW;
        const h = Math.floor(i / decW);
        if (decompressedSignal[i]) {
            ctxD.fillRect(w, h, 1, 1);
        }
    }

    ctxD.fillStyle = 'white';
    ctxD.fillRect(decompressedSignal.length % decW, canvasD.height - 1, decW, 1);
};

const drawCompressedSignal = () => {
    const { canvasC, ctxC, compressedSignal } = state;

    const dpr = window.devicePixelRatio;
    const w = Math.ceil(Math.min(Math.sqrt(compressedSignal.length), window.innerWidth * 0.2));
    const h = Math.ceil(compressedSignal.length / w);

    canvasC.width = w;
    canvasC.height = h;
    canvasC.style.width = `${w * 2}px`;
    canvasC.style.height = `${h * 2}px`;

    ctxC.fillStyle = 'black';
    ctxC.fillRect(0, 0, w, h);
    ctxC.fillStyle = 'white';
    for (let i = 0; i < compressedSignal.length; i++) {
        const x = i % w;
        const y = Math.floor(i / w);
        if (compressedSignal[i]) {
            ctxC.fillRect(x, y, 1, 1);
        }
    }
};


const verifyComp = () => {
    const { sourceSignal, decompressedSignal } = state;
    if (sourceSignal.length !== decompressedSignal.length) {
        return false;
    }

    for (let i = 0; i < sourceSignal.length; i++) {
        if (sourceSignal[i] !== decompressedSignal[i]) {
            console.log(i, sourceSignal[i], decompressedSignal[i]);
            return false;
        }
    }

    return true;
};

const appendTable = (parentDiv) => {
    const { cMetaBlocks } = state;

    const compressedInfoTable = document.createElement("table");
    const tableHead = document.createElement("thead");
    const tableBody = document.createElement("tbody");

    const appendRow = (colText, isHeader = false) => {
        const row = document.createElement("tr");
        colText.forEach(c => {
            const col = document.createElement("td");
            col.innerHTML = c;
            row.appendChild(col);
        });
        if (isHeader) {
            tableHead.appendChild(row);
        } else {
            tableBody.appendChild(row);
        }
    };

    // header
    appendRow(['start', 'delta', 'preamble', 'encoding'], true);

    cMetaBlocks.slice(0, 10).forEach(block => {
        const binString = block.delta.toString(2);
        const bin = binString.split('').map(d => d === '1' ? 1 : 0).join('');
        const preamble = new Array(bin.length).fill(0).join('');
        appendRow([intFormat(block.start), intFormat(block.delta), preamble, bin]);
    });

    compressedInfoTable.appendChild(tableHead);
    compressedInfoTable.appendChild(tableBody);
    parentDiv.appendChild(compressedInfoTable);
};

const onRun = () => {
    const { canvasC, canvasD, ctxD, compressedInfo } = state;

    state.sourceSignal = genSourceSignal();
    drawSourceSignal();

    state.compressedSignal = RLE();
    drawCompressedSignal();

    state.decompressedSignal = deRLE();
    drawDecompressedSignal();

    compressedInfo.innerHTML = '';
    const sizeDiv = document.createElement("div");

    // todo better number format
    const sourceSize = state.sourceSignal.length;
    const compSize = state.compressedSignal.length;
    const factor = (compSize / sourceSize).toFixed(3);
    sizeDiv.innerHTML = `${intFormat(sourceSize)} -> ${intFormat(compSize)} bits. (${factor}x)`;
    compressedInfo.appendChild(sizeDiv);

    const entropyDiv = document.createElement("div");
    const entropy = state.n * state.p * Math.log2(1 / state.p);
    entropyDiv.innerHTML = `ensemble expected bits of info: ${intFormat(entropy.toFixed(2))}`;
    compressedInfo.appendChild(entropyDiv);


    const verified = verifyComp();
    const vDiv = document.createElement("div");
    vDiv.innerHTML = verified ? 'Decompressed matches source :)' : 'Mismatch!';

    compressedInfo.appendChild(vDiv);

    appendTable(compressedInfo);
}

const onMove = (e) => {
    const { top, left } = e.target.getBoundingClientRect();
    const x = Math.round(e.clientX - left);
    const y = Math.round(e.clientY - top);

    // todo
};

const init = () => {
    // init state
    resetState();

    // create events
    const runButton = document.getElementById('run');
    runButton.addEventListener('click', onRun);

    const pInput = document.getElementById('p');
    pInput.addEventListener('change', () => resetState());

    const pLogInput = document.getElementById('pLog');
    pLogInput.addEventListener('input', (e) => {
        const pLog = Math.pow(10, parseFloat(e.target.value, 10));
        pInput.value = pLog.toPrecision(3);
        resetState();
    });

    const nInput = document.getElementById('n');
    nInput.addEventListener('change', () => resetState());

    const nLogInput = document.getElementById('nLog');
    nLogInput.addEventListener('input', (e) => {
        const nLog = Math.pow(10, parseFloat(e.target.value, 10));
        nInput.value = Math.ceil(nLog);
    });

    // only reset on change, not on input for n input
    nLogInput.addEventListener('change', () => {
        resetState();
    });

    // todo add hover interactions
    // document.getElementById('canvas').addEventListener('mousemove', onMove);
};

// global events
window.addEventListener('load', init);
