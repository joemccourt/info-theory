const stateDefaults = {
    f: 0.07,
    code: 1
};

let state = { ...stateDefaults };

const byteToBitArray = (sourceByte) => {
    const bitArray = [0, 0, 0, 0, 0, 0, 0, 0];
    bitArray[0] = sourceByte & 1;
    bitArray[1] = (sourceByte & 2) >> 1;
    bitArray[2] = (sourceByte & 4) >> 2;
    bitArray[3] = (sourceByte & 8) >> 3;
    bitArray[4] = (sourceByte & 16) >> 4;
    bitArray[5] = (sourceByte & 32) >> 5;
    bitArray[6] = (sourceByte & 64) >> 6;
    bitArray[7] = (sourceByte & 128) >> 7;
    return bitArray.reverse();
};

// get parity for 8 bit number
const parity = b => {
   let y = b ^ (b >> 1);
   y = y ^ (y >> 2);
   y = y ^ (y >> 4);
   return y & 1;
};

const codeToRepition = (code) => {
    if (code === 1) {
        return 3;
    }
    if (code === 2) {
        return 5;
    }
    if (code === 3) {
        return 7;
    }
    if (code === 4) {
        return 9;
    }
    if (code === 5) {
        return 2;
    }
    return 1;
};

const resetState = (e) => {
    state = { ...stateDefaults };
    const el = document.getElementById('canvas');
    state.canvas = el;

    state.w = el.width;
    state.h = el.height;

    const ctx = el.getContext('2d');
    state.ctx = ctx;

    state.inspector = document.getElementById('inspector');
    state.inspector.innerHTML = '';

    const img = document.getElementById('road');
    ctx.drawImage(img, 0, 0);

    const codeInput = document.getElementById('correcting-code');
    state.code = parseInt(codeInput.value, 10) ?? state.code;

    const fInput = document.getElementById('f');
    state.f = parseFloat(fInput.value, 10) / 100 ?? state.f;
    fInput.value = Math.round(100 * (100 * state.f)) / 100;
};

const runBinarySymmetricChannel = (sourceData, encoder, decoder) => {
    const encodedData = encoder(sourceData);
    state.original = new Uint8Array(sourceData);
    state.encoded = new Uint8Array(encodedData);

    // bits over the wire, binary symmetric noise
    const flipStream = new Uint8Array(encodedData.length);
    state.flipStream = flipStream;
    const f = state.f;

    for (let i = 0; i < encodedData.length; i++) {
        const b1 = Math.random() < f ? 1 : 0;
        const b2 = Math.random() < f ? 1 : 0;
        const b3 = Math.random() < f ? 1 : 0;
        const b4 = Math.random() < f ? 1 : 0;
        const b5 = Math.random() < f ? 1 : 0;
        const b6 = Math.random() < f ? 1 : 0;
        const b7 = Math.random() < f ? 1 : 0;
        const b8 = Math.random() < f ? 1 : 0;

        flipStream[i] = b1 | (b2 << 1) | (b3 << 2) | (b4 << 3) | (b5 << 4) | (b6 << 5) | (b7 << 6) | (b8 << 7);
    };

    for (let idx = 0; idx < encodedData.length; idx++) {
        encodedData[idx] = encodedData[idx] ^ flipStream[idx];
    }

    state.encodedT = encodedData;

    return decoder(encodedData);
};

const onTransmit = () => {
    const { ctx, canvas, code } = state;
    const img = document.getElementById('road');
    ctx.drawImage(img, 0, 0);

    const dpr = window.devicePixelRatio;
    const pixelData = ctx.getImageData(0, 0, img.width, img.height);
    const { width: w, height: h } = pixelData;

    let encoder = (s) => s;
    let decoder = (s) => s;

    // duplicator
    const dupeMult = codeToRepition(code);
    encoder = (source) => {
        const encoded = new Uint8Array(source.length * dupeMult);
        for (let i = 0; i < source.length; i++) {
            for (let j = 0; j < dupeMult; j++) {
                encoded[i * dupeMult + j] = source[i];
            }
        }
        return encoded;
    };

    decoder = (source) => {
        const originalLength = source.length / dupeMult;
        const decoded = new Uint8Array(originalLength);

        for (let i = 0; i < originalLength; i++) {
            const bitArray = [0, 0, 0, 0, 0, 0, 0, 0];
            for (let j = 0; j < dupeMult; j++) {
                const sourceByte = source[i * dupeMult + j];
                bitArray[0] += sourceByte & 1;
                bitArray[1] += (sourceByte & 2) >> 1;
                bitArray[2] += (sourceByte & 4) >> 2;
                bitArray[3] += (sourceByte & 8) >> 3;
                bitArray[4] += (sourceByte & 16) >> 4;
                bitArray[5] += (sourceByte & 32) >> 5;
                bitArray[6] += (sourceByte & 64) >> 6;
                bitArray[7] += (sourceByte & 128) >> 7;
            }
            for (let k = 0; k < 8; k++) {
                bitArray[k] = Math.round(bitArray[k] / dupeMult);
            }
            const newByte = bitArray[0] | (bitArray[1] << 1) | (bitArray[2] << 2) | (bitArray[3] << 3) | (bitArray[4] << 4) | (bitArray[5] << 5) | (bitArray[6] << 6) | (bitArray[7] << 7);
            decoded[i] = newByte;
        }

        return decoded;
    };

    if (code === 5) {
        encoder = (source) => {
            const getP = [0, 3, 7, 4, 6, 5, 1, 2, 5, 6, 2, 1, 3, 0, 4, 7];
            const encoded = new Uint8Array(source.length * 2);
            for (let i = 0; i < source.length; i++) {
                const sourceNibble1 = source[i] >> 4;
                const sourceNibble2 = source[i] & 15; // 00001111
                const firstByte = (sourceNibble1 << 4) | getP[sourceNibble1];
                const secondByte = (sourceNibble2 << 4) | getP[sourceNibble2];

                encoded[2 * i] = firstByte;
                encoded[2 * i + 1] = secondByte;
            }
            return encoded;
        };

        decoder = (source) => {
            const originalLength = source.length / 2;
            const decoded = new Uint8Array(originalLength);

            const sFlip = [0, 0, 0, 1, 0, 8, 4, 2]; // to xor first 4 bits
            for (let i = 0; i < originalLength; i++) {
                const sourceByte1 = source[i * 2];
                const sourceByte2 = source[i * 2 + 1];

                // 11100100 228 01110010 114 10110001 177
                const firstSyndrome = (parity(sourceByte1 & 228) << 2) | (parity(sourceByte1 & 114) << 1) | parity(sourceByte1 & 177);
                const firstNibble = (sourceByte1 >> 4) ^ sFlip[firstSyndrome];

                const secondSyndrome = (parity(sourceByte2 & 228) << 2) | (parity(sourceByte2 & 114) << 1) | parity(sourceByte2 & 177);
                const secondNibble = (sourceByte2 >> 4) ^ sFlip[secondSyndrome];

                decoded[i] = (firstNibble << 4) | secondNibble;
            }

            return decoded;
        };
    }

    const transmittedData = runBinarySymmetricChannel(pixelData.data, encoder, decoder);
    state.decoded = transmittedData;

    for (let idx = 0; idx < 4 * w * h; idx++) {
        if (idx % 4 === 3) {
            continue;
        }
        pixelData.data[idx] = transmittedData[idx];
    }

    ctx.putImageData(pixelData, 0, 0);

};

const setCorrectingCode = (e) => {
    state.code = parseInt(e.target.value, 10);
};

const onMove = (e) => {
    const {top, left} = e.target.getBoundingClientRect();
    const x = Math.round(e.clientX - left);
    const y = Math.round(e.clientY - top);

    const { inspector, w, h, original, decoded, encoded, encodedT, code, flipStream } = state;

    const idx = 4 * (w * y + x);
    const r = original[idx];
    const g = original[idx+1];
    const b = original[idx+2];

    const rOrigin = byteToBitArray(r).join('');
    const gOrigin = byteToBitArray(g).join('');
    const bOrigin = byteToBitArray(b).join('');

    const rD = decoded[idx];
    const gD = decoded[idx+1];
    const bD = decoded[idx+2];

    const rDecoded = byteToBitArray(rD).join('');
    const gDecoded = byteToBitArray(gD).join('');
    const bDecoded = byteToBitArray(bD).join('');

    const dupeMult = codeToRepition(code);
    let rEncoded = '';
    let gEncoded = '';
    let bEncoded = '';
    for (let i = 0; i < dupeMult; i++) {
        rEncoded += byteToBitArray(encoded[dupeMult * idx + i]).join('');
        gEncoded += byteToBitArray(encoded[dupeMult * idx + 1 * dupeMult + i]).join('');
        bEncoded += byteToBitArray(encoded[dupeMult * idx + 2 * dupeMult + i]).join('');
    }
    let rFlip = '';
    let gFlip = '';
    let bFlip = '';
    for (let i = 0; i < dupeMult; i++) {
        rFlip += byteToBitArray(flipStream[dupeMult * idx + i]).join('');
        gFlip += byteToBitArray(flipStream[dupeMult * idx + 1 * dupeMult + i]).join('');
        bFlip += byteToBitArray(flipStream[dupeMult * idx + 2 * dupeMult + i]).join('');
    }

    let rEncodedT = '';
    let gEncodedT = '';
    let bEncodedT = '';
    for (let i = 0; i < dupeMult; i++) {
        rEncodedT += byteToBitArray(encodedT[dupeMult * idx + i]).join('');
        gEncodedT += byteToBitArray(encodedT[dupeMult * idx + 1 * dupeMult + i]).join('');
        bEncodedT += byteToBitArray(encodedT[dupeMult * idx + 2 * dupeMult + i]).join('');
    }

    inspector.innerHTML = '';

    const createRow = (colText) => {
        const row = document.createElement("tr");
        colText.forEach(t => {
            const c = document.createElement("td");
            if (t === '') {
                c.style.background = `rgb(${r}, ${g}, ${b})`;
            }
            if (t === ' ') {
                c.style.background = `rgb(${rD}, ${gD}, ${bD})`;
            }
            c.innerHTML = t;
            row.appendChild(c);
        });
        return row;
    }

    inspector.appendChild(createRow(['', 'Red ' + r, 'Green ' + g, 'Blue ' + b]));
    inspector.appendChild(createRow(['Original', rOrigin, gOrigin, bOrigin]));
    inspector.appendChild(createRow(['Encoded', rEncoded, gEncoded, bEncoded]));
    inspector.appendChild(createRow(['Flipped', rFlip, gFlip, bFlip]));
    inspector.appendChild(createRow(['Transmitted', rEncodedT, gEncodedT, bEncodedT]));
    inspector.appendChild(createRow(['Decoded', rDecoded, gDecoded, bDecoded]));
    inspector.appendChild(createRow([' ', 'Red ' + rD, 'Green ' + gD, 'Blue ' + bD]));
};

const BG_COLOR = '#ffffff';
const init = () => {
    document.body.style.background = BG_COLOR;

    // init state
    resetState();

    // create events
    const transmitButton = document.getElementById('transmit');
    transmitButton.addEventListener('click', onTransmit);

    const correctingCode = document.getElementById('correcting-code');
    correctingCode.addEventListener('click', setCorrectingCode);

    const fInput = document.getElementById('f');
    fInput.addEventListener('change', () => resetState());

    // document.getElementById('reset').addEventListener('click', () => resetState());

    document.getElementById('canvas').addEventListener('mousemove', onMove);
};

// global events
window.addEventListener('load', init);
