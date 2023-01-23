const stateDefaults = {
    p: 0.3,
    n: 7,
    totalCoins: 0,
    flipTry: -1,
    play: false,
    goalFlips: 0,
    speed: 1
};
let state = { ...stateDefaults };

const resetState = (e) => {
    state = { ...stateDefaults };

    const playButton = document.getElementById('play');
    playButton.innerHTML = 'Play';

    state.flips = [];
    state.flipSums = [];
    state.numTrialsByHeads = [];

    const pInput = document.getElementById('p');
    const nInput = document.getElementById('n');
    state.n = parseInt(nInput.value, 10) ?? state.n;
    state.p = parseFloat(pInput.value, 10) ?? state.p;

    nInput.value = state.n;
    pInput.value = state.p;

    state.numTrialsByHeads = new Array(state.n + 1).fill(0);

    state.speed = parseInt(document.getElementById('speed').value, 10);

    // Setting canvas size properly
    onResize();

    drawWorld();
};

// entropy function
const h2 = (x) => {
    if (x === 0 || x === 1) {
        return 0;
    }
    return x * Math.log2(1 / x) + (1 - x) * Math.log2(1 / (1 - x));
};

// breaks at 170
const factMemo = [];
const fact = (k) => {
    if (k === 0) { return 1; }
    if (factMemo[k]) {
        return factMemo[k];
    }
    let f = 1;
    for (let i = 2; i <= k; i++) {
        f *= i;
    };
    factMemo[k] = f;
    return f;
};

// will hit numerical limits at ~n=1000
const choose = (n, r) => {
    // fact hits double limit at ~170
    if (n < 170) {
        return fact(n) / fact(n - r) / fact(r);
    }

    // use approx for high n cases
    const firstOrder = n * h2(r / n);
    const secondOrder = r === 0 ? 0 : -0.5 * Math.log2(2 * Math.PI * (n - r) * r / n);
    return Math.pow(2, firstOrder + secondOrder);
};

const chooseLog = (n, r) => {
    if (n < 170) {
        return Math.log2(fact(n) / fact(n - r) / fact(r));
    }

    // use approx for high n cases
    const firstOrder = n * h2(r / n);
    const secondOrder = (r === 0 || r === n) ? 0 : -0.5 * Math.log2(2 * Math.PI * (n - r) * r / n);
    return firstOrder + secondOrder;
};

const onResize = () => {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const dpr = window.devicePixelRatio;

    // const minDim = Math.min(windowW, windowH);
    const el = document.getElementById('canvas');

    el.style.width = `${windowW}px`;
    el.style.height = `${windowH}px`;
    state.w = windowW;
    state.h = windowH;

    const w = Math.round(state.w * dpr);
    const h = Math.round(state.h * dpr);
    el.width = w;
    el.height = h;

    // const ctxScale = Math.min(w, h) / minDim;
    const ctx = el.getContext('2d');
    ctx.scale(w / state.w, h / state.h);
    state.ctx = ctx;
``
    drawWorld();
};

const flipCoinIsHeads = (p) => {
    return Math.random() < p ? 1 : 0;
};

const flipOneCoin = () => {
    const trialIter = state.totalCoins % state.n;
    if (trialIter === 0) {
        if (state.flipTry >= 0) {
            const flipSum = sumFlips(state.flips[state.flipTry]);
            state.flipSums.push(flipSum);
            state.numTrialsByHeads[flipSum]++;
        }
        state.flipTry++;
        state.flips[state.flipTry] = new Uint8Array(state.n);
    }
    state.flips[state.flipTry][trialIter] = flipCoinIsHeads(state.p);
    state.totalCoins++;
}

const sumFlips = (flips) => {
    let sum = 0;
    for (let i = 0; i < state.n; i++) {
        sum += flips[i];
    }
    return sum;
}

const onCoinFlip = (e) => {
    state.goalFlips++;
    flipOneCoin();
    drawWorld();
};

const flipsToTxt = (flips, limit) => {
    const chars = new Array(limit).fill().map((_, i) => flips[i] ? 'H' : 'T');
    if (chars.length > 15) {
        return chars.slice(0, 15).join('') + '…';
    }
    return chars.join('');
}

const drawFlipRow = (flipTry) => {
    const { ctx, w, h, flips, n, totalCoins } = state;

    const limit = (flipTry + 1) * n <= totalCoins ? n : totalCoins % n;
    const row = { x: 5, y: 10 + 24 * (flips.length - flipTry), h: 24 };

    if (row.y > h) { return; }

    const flipTrial = state.flips[flipTry];
    const numH = sumFlips(flipTrial);
    const numF = limit;
    const numT = numF - numH;
    const barF = numF === 0 ? 0 : numH / (numH + numT);

    const barWidth = 80;
    ctx.fillStyle = '#0a0';
    ctx.fillRect(row.x, row.y, barF * barWidth, row.h);

    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.rect(row.x, row.y, barWidth, row.h);
    ctx.stroke();

    ctx.font = `24px serif`; // todo how to get monospace font here
    ctx.fillStyle = '#000';
    ctx.fillText(flipsToTxt(flipTrial, limit) + ` (${numH} H)`, row.x + barWidth + 2, row.y + row.h / 2);
    ctx.fillText((barF * 100).toFixed(0) + '%', row.x + barWidth / 4, row.y + row.h / 2);
}

const drawWorld = () => {
    const { ctx, w, h, flips, n, p, totalCoins, numTrialsByHeads } = state;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'middle';

    ctx.font = `24px serif`;
    ctx.fillStyle = '#000';
    ctx.fillText('Coin Flip History:', 4, 12);
    ctx.moveTo(4, 26);
    ctx.lineTo(200, 26);
    ctx.stroke();
    flips.forEach((_, i) => drawFlipRow(i));

    const numHeadsByFlip = state.flipSums;
    const numTrials = numHeadsByFlip.length;

    const maxFreq = Math.max(...numTrialsByHeads);
    const maxFreqValue = numTrialsByHeads.indexOf(maxFreq);

    let totalHeads = 0;
    let totalTrials = 0;
    let medianHeads = 0;
    let sumSquares = 0;
    numTrialsByHeads.forEach((trials, heads) => {
        if (totalTrials < numTrials / 2 && totalTrials + trials >= numTrials / 2) {
            medianHeads = heads + (totalTrials + trials - numTrials / 2) / trials;
        }
        totalTrials += trials;
        totalHeads += trials * heads;
        sumSquares += trials * Math.pow(heads, 2);
    });
    const avgHeads = totalHeads / numTrials ?? 0;
    const variance = sumSquares / numTrials - (avgHeads ** 2);
    const std = Math.sqrt(Math.abs(variance));

    const graph = { x: w * 0.45, y: h / 8, w: w * 0.5, h: h * 0.45 };
    ctx.fillStyle = '#fff';
    ctx.fillRect(graph.x, graph.y, graph.w, graph.h);

    ctx.strokeStyle = '#000';
    ctx.moveTo(graph.x, graph.y);
    ctx.lineTo(graph.x, graph.y + graph.h);
    ctx.lineTo(graph.x + graph.w, graph.y + graph.h);
    ctx.stroke();

    ctx.fillStyle = 'rgba(200, 0, 200, 0.3)';
    const expectedRates = new Array(n + 1).fill().map((_, r) => chooseLog(n, r) + r * Math.log2(p) + (n - r) * Math.log2(1 - p))
        .map((v, r) => {
            // edge cases
            if (p === 0) {
                if (r === 0) {
                    return 0;
                }
                return -Infinity
            }
            if (p === 1) {
                if (r === n) {
                    return 0;
                }
                return -Infinity
            }
            return v;
        });

    const maxRate = Math.max(numTrials === 0 ? 0 : (maxFreq / numTrials), Math.pow(2, Math.max(...expectedRates)));
    // console.log(expectedRates, maxRate);
    expectedRates.forEach((rate, r) => {
        const barH = (Math.pow(2, rate) / maxRate) * graph.h;
        const x = graph.x + r / (n + 1) * graph.w;
        const y = graph.y + graph.h - barH;
        ctx.fillRect(x, y, graph.w / (n + 1), barH);
    });

    ctx.fillStyle = '#0a0';
    const barWidth = 0.8 * graph.w / (n + 1);
    const barGapHalf = 0.1 * graph.w / (n + 1);
    numTrialsByHeads.forEach((trials, heads) => {
        const barH = trials / numTrials / maxRate * graph.h;
        const x = graph.x + heads / (n + 1) * graph.w;
        const y = graph.y + graph.h - barH;
        ctx.fillRect(x + barGapHalf, y, barWidth, barH);
    });

    ctx.font = `24px serif`;

    
    const freqText = `${(maxRate * numTrials).toFixed(0)} (${numTrials === 0 ? 0 : (maxRate * 100).toFixed(0)}%)`;
    drawGraphTick(graph, freqText, 0, '#000', -graph.h - 24);

    const expectedMean = state.p * state.n;
    const expectedStd = Math.sqrt(state.p * (1 - state.p) * state.n);
    drawGraphTick(graph, `Expected Mean ${expectedMean.toFixed(2)}, std ${expectedStd.toFixed(2)}`, expectedMean, '#909', 24 * 1 + 12, expectedStd);
    // drawGraphTick(graph, `Median ${medianHeads.toFixed(2)}`, medianHeads, '#00b', 20 * 2 + 12);
    drawGraphTick(graph, `Actual Mean ${avgHeads.toFixed(2)}, Std ${std.toFixed(2)}`, avgHeads, '#000', 24 * 0 + 12, std);
    // drawGraphTick(graph, `Mode ${maxFreqValue}`, maxFreqValue, '#090', 12);    
};

const drawGraphTick = (graph, text, value, color, tickH, halfWidth = 0) => {
    const { ctx, n } = state;

    if (isNaN(value)) { return; }
    const valueX = (value + 0.5) / (n + 1) * graph.w + graph.x;

    if (tickH >= 0) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.moveTo(valueX, graph.y + graph.h);
        ctx.lineTo(valueX, graph.y + graph.h + tickH);
        ctx.stroke();
    }

    if (halfWidth) {
        const halfWidthDX = halfWidth / (n + 1) * graph.w;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.moveTo(valueX - halfWidthDX, graph.y + graph.h + tickH);
        // ctx.lineTo(valueX, graph.y + graph.h + tickH);
        ctx.lineTo(valueX + halfWidthDX, graph.y + graph.h + tickH);
        ctx.stroke();
    }

    ctx.fillStyle = color;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, valueX - textWidth / 2, graph.y + graph.h + tickH + 12);
}

const onPlayPause = () => {
    state.play = !state.play;

    const playButton = document.getElementById('play');
    playButton.innerHTML = state.play ? 'Pause' : 'Play';
};

const setSpeed = (e) => {
    state.speed = parseInt(e.target.value, 10);
};

const BG_COLOR = '#ffffff';
const init = () => {
    document.body.style.background = BG_COLOR;

    // init state
    resetState();

    // create events
    const coinFlipButton = document.getElementById('flipCoin');
    const playButton = document.getElementById('play');
    const resetButton = document.getElementById('reset');
    coinFlipButton.addEventListener('click', onCoinFlip);
    playButton.addEventListener('click', onPlayPause);
    resetButton.addEventListener('click', resetState);

    const pInput = document.getElementById('p');
    const nInput = document.getElementById('n');
    const speedInput = document.getElementById('speed');
    pInput.addEventListener('change', () => resetState());
    nInput.addEventListener('change', () => resetState());
    speedInput.addEventListener('click', setSpeed);

    let lastTime = new Date().getTime();
    const timeUpdate = (dt) => {
        if (state.play === false) {
            return;
        }
        
        state.goalFlips += (dt - lastTime) * state.speed / 1000 * state.n;
        while(state.totalCoins < state.goalFlips) {
            flipOneCoin();
        }
        drawWorld();        
    };
    
    const loop = () => {
        requestAnimationFrame((dt) => {
            timeUpdate(dt);
            lastTime = dt;
            loop();
        });
    };

    drawWorld();
    loop();
};

// global events
window.addEventListener('load', init);
window.addEventListener('resize', onResize);
