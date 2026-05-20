document.addEventListener('DOMContentLoaded', () => {
    // --- NAV LOGIC ---
    const navItems = document.querySelectorAll('.nav-item');
    const modules = document.querySelectorAll('.module');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            modules.forEach(m => m.classList.remove('active'));
            
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
        });
    });

    // --- ROUND ROBIN ---
    let processCount = 2;
    const addProcessBtn = document.getElementById('rr-add-process');
    addProcessBtn.addEventListener('click', () => {
        processCount++;
        const tbody = document.querySelector('#rr-table tbody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>P${processCount} (Nuevo)</td>
            <td><input type="number" value="${processCount}" min="0" class="input-sm rr-arr"></td>
            <td><input type="number" value="3" min="1" class="input-sm rr-bur"></td>
            <td><button class="btn-delete-process" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); border-radius: 4px; cursor: pointer; padding: 2px 8px;">X</button></td>
        `;
        tbody.appendChild(tr);
        tr.querySelector('.btn-delete-process').addEventListener('click', () => tr.remove());
    });

    document.querySelectorAll('#rr-table tbody tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input');
        if (inputs.length >= 2) {
            inputs[0].classList.add('rr-arr');
            inputs[1].classList.add('rr-bur');
        }
    });

    const rrRun = document.getElementById('rr-run');
    rrRun.addEventListener('click', runRoundRobin);

    function runRoundRobin() {
        const quantum = parseInt(document.getElementById('rr-quantum').value);
        const rows = document.querySelectorAll('#rr-table tbody tr');
        let processes = [];
        
        rows.forEach((row, index) => {
            const arrInput = row.querySelector('.rr-arr');
            const burInput = row.querySelector('.rr-bur');
            if(arrInput && burInput) {
                processes.push({
                    id: `P${index+1}`,
                    arrival: parseInt(arrInput.value),
                    burst: parseInt(burInput.value),
                    remBurst: parseInt(burInput.value),
                    startTime: -1,
                    completionTime: 0,
                    turnaroundTime: 0,
                    waitingTime: 0,
                    color: `hsl(${index * 137.5 % 360}, 70%, 60%)`
                });
            }
        });

        processes.sort((a,b) => a.arrival - b.arrival);
        
        let time = 0;
        let completed = 0;
        let gantt = [];
        let readyQueue = [];
        let pIndex = 0;

        while (pIndex < processes.length && processes[pIndex].arrival <= time) {
            readyQueue.push(processes[pIndex]);
            pIndex++;
        }

        while(completed < processes.length) {
            if (readyQueue.length === 0) {
                time++;
                while (pIndex < processes.length && processes[pIndex].arrival <= time) {
                    readyQueue.push(processes[pIndex]);
                    pIndex++;
                }
                continue;
            }

            let p = readyQueue.shift();
            if (p.startTime === -1) p.startTime = time;

            let execTime = Math.min(quantum, p.remBurst);
            gantt.push({ id: p.id, color: p.color, start: time, duration: execTime });
            
            time += execTime;
            p.remBurst -= execTime;

            while (pIndex < processes.length && processes[pIndex].arrival <= time) {
                readyQueue.push(processes[pIndex]);
                pIndex++;
            }

            if (p.remBurst > 0) {
                readyQueue.push(p);
            } else {
                p.completionTime = time;
                p.turnaroundTime = p.completionTime - p.arrival;
                p.waitingTime = p.turnaroundTime - p.burst;
                completed++;
            }
        }

        const ganttContainer = document.getElementById('rr-gantt');
        ganttContainer.innerHTML = '';
        let totalTime = time;
        
        gantt.forEach(block => {
            const div = document.createElement('div');
            div.className = 'gantt-block';
            let widthPct = (block.duration / totalTime) * 100;
            div.style.width = widthPct + '%';
            div.style.backgroundColor = block.color;
            div.innerText = block.id;
            ganttContainer.appendChild(div);
        });

        let avgWT = processes.reduce((acc, p) => acc + p.waitingTime, 0) / processes.length;
        let avgTAT = processes.reduce((acc, p) => acc + p.turnaroundTime, 0) / processes.length;

        document.getElementById('rr-stats').innerHTML = `
            <div class="stat-box">Tiempo Espera (WT) Promedio <span>${avgWT.toFixed(2)} ms</span></div>
            <div class="stat-box">Tiempo Retorno (TAT) Promedio <span>${avgTAT.toFixed(2)} ms</span></div>
        `;
        document.getElementById('rr-results').style.display = 'block';
    }

    // --- PAGE REPLACEMENT ---
    const prRun = document.getElementById('pr-run');
    prRun.addEventListener('click', runPageReplacement);

    function runPageReplacement() {
        const framesCount = parseInt(document.getElementById('pr-frames').value);
        const refsStr = document.getElementById('pr-refs').value;
        const refs = refsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const algo = document.getElementById('pr-algo').value;
        
        let frames = [];
        let faults = 0;
        const vizContainer = document.getElementById('pr-visualization');
        vizContainer.innerHTML = '';

        for (let i = 0; i < refs.length; i++) {
            let page = refs[i];
            let isFault = false;
            let frameIndex = frames.findIndex(f => f.page === page);

            if (frameIndex !== -1) {
                frames[frameIndex].lastUsed = i;
                frames[frameIndex].useCount++;
                frames[frameIndex].refBit = 1;
            } else {
                isFault = true;
                faults++;
                if (frames.length < framesCount) {
                    frames.push({ page: page, lastUsed: i, useCount: 1, refBit: 1, loadTime: i });
                } else {
                    let replaceIndex = -1;
                    if (algo === 'fifo') {
                        let oldestTime = Infinity;
                        frames.forEach((f, idx) => { if(f.loadTime < oldestTime) { oldestTime = f.loadTime; replaceIndex = idx; }});
                    } else if (algo === 'lru') {
                        let oldestUsed = Infinity;
                        frames.forEach((f, idx) => { if(f.lastUsed < oldestUsed) { oldestUsed = f.lastUsed; replaceIndex = idx; }});
                    } else if (algo === 'optimo') {
                        let farthest = -1;
                        frames.forEach((f, idx) => {
                            let nextUse = refs.slice(i+1).indexOf(f.page);
                            if (nextUse === -1) nextUse = Infinity;
                            if (nextUse > farthest) { farthest = nextUse; replaceIndex = idx; }
                        });
                    } else if (algo === 'sc') {
                        let found = false;
                        while(!found) {
                            let oldest = Infinity; let curIdx = 0;
                            frames.forEach((f, idx) => { if(f.loadTime < oldest) { oldest = f.loadTime; curIdx = idx; }});
                            if (frames[curIdx].refBit === 1) {
                                frames[curIdx].refBit = 0;
                                frames[curIdx].loadTime = i; 
                            } else {
                                replaceIndex = curIdx;
                                found = true;
                            }
                        }
                    } else if (algo === 'lfu') {
                        let lowestFreq = Infinity;
                        frames.forEach((f, idx) => { if(f.useCount < lowestFreq) { lowestFreq = f.useCount; replaceIndex = idx; }});
                    }
                    
                    frames[replaceIndex] = { page: page, lastUsed: i, useCount: 1, refBit: 1, loadTime: i };
                }
            }

            const stepDiv = document.createElement('div');
            stepDiv.className = 'frame-step';
            stepDiv.innerHTML = `<div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${page}</div>`;
            
            for(let j = 0; j < framesCount; j++) {
                const cell = document.createElement('div');
                if (j < frames.length) {
                    let isCurrentReplaced = isFault && frames[j].page === page;
                    let isHit = !isFault && frames[j].page === page;
                    cell.className = 'frame-cell ' + (isCurrentReplaced ? 'fault' : (isHit ? 'hit' : ''));
                    cell.innerText = frames[j].page;
                } else {
                    cell.className = 'frame-cell';
                    cell.innerText = '-';
                }
                stepDiv.appendChild(cell);
            }
            vizContainer.appendChild(stepDiv);
        }

        document.getElementById('pr-stats').innerHTML = `<p style="margin-top:15px; font-size: 18px;">Total Fallos de Página: <strong style="color:var(--danger)">${faults}</strong></p>`;
        document.getElementById('pr-results').style.display = 'block';
    }

    // --- DISK SCHEDULING ---
    const dsRun = document.getElementById('ds-run');
    dsRun.addEventListener('click', runDiskScheduling);

    function runDiskScheduling() {
        const initPos = parseInt(document.getElementById('ds-init').value);
        const reqsStr = document.getElementById('ds-reqs').value;
        const reqs = reqsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const algo = document.getElementById('ds-algo').value;

        let currentPos = initPos;
        let totalSeek = 0;
        let sequence = [currentPos];
        let pending = [...reqs];

        if (algo === 'fifo') {
            pending.forEach(r => {
                totalSeek += Math.abs(currentPos - r);
                currentPos = r;
                sequence.push(currentPos);
            });
        } else if (algo === 'sstf') {
            while(pending.length > 0) {
                let closestIdx = 0;
                let minDiff = Math.abs(currentPos - pending[0]);
                for(let i=1; i<pending.length; i++) {
                    let diff = Math.abs(currentPos - pending[i]);
                    if (diff < minDiff) { minDiff = diff; closestIdx = i; }
                }
                totalSeek += minDiff;
                currentPos = pending[closestIdx];
                sequence.push(currentPos);
                pending.splice(closestIdx, 1);
            }
        } else if (algo === 'scan' || algo === 'cscan') {
            pending.push(initPos);
            pending.sort((a,b) => a - b);
            let initIdx = pending.indexOf(initPos);
            
            let up = pending.slice(initIdx + 1);
            let down = pending.slice(0, initIdx).reverse();
            
            let seqReqs = [];
            if (algo === 'scan') {
                if (up.length > 0) up.push(199);
                seqReqs = [...up, ...down];
            } else if (algo === 'cscan') {
                if (up.length > 0) up.push(199);
                if (down.length > 0) {
                    seqReqs = [...up, 0, ...down.reverse()];
                } else {
                    seqReqs = [...up];
                }
            }

            seqReqs.forEach(r => {
                totalSeek += Math.abs(currentPos - r);
                currentPos = r;
                sequence.push(currentPos);
            });
        }

        const viz = document.getElementById('ds-points');
        viz.innerHTML = `<div style="padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; color: var(--text-main); font-family: monospace; word-wrap: break-word; line-height: 1.6;"><strong>Trayectoria:</strong><br/> ${sequence.join(' &rarr; ')}</div>`;
        document.getElementById('ds-stats').innerHTML = `<p style="font-size: 18px; margin-top: 15px;">Desplazamiento Total: <strong style="color:var(--accent)">${totalSeek} cilindros</strong></p>`;
        document.getElementById('ds-results').style.display = 'block';
    }

    // --- COMPARISON ---
    const compRun = document.getElementById('comp-run');
    compRun.addEventListener('click', runComparison);

    function runComparison() {
        document.getElementById('comp-results').style.display = 'grid';
        
        // Ejecutamos logicamente contra unos sets de datos por defecto para demostrar la eficiencia real
        const memRefs = [7,0,1,2,0,3,0,4,2,3,0,3,2];
        const memFramesCount = 3;
        
        function simularMem(algo) {
            let frames = []; let faults = 0;
            memRefs.forEach((page, i) => {
                let frameIndex = frames.findIndex(f => f.page === page);
                if (frameIndex !== -1) {
                    frames[frameIndex].lastUsed = i; frames[frameIndex].useCount++; frames[frameIndex].refBit = 1;
                } else {
                    faults++;
                    if (frames.length < memFramesCount) { frames.push({ page: page, lastUsed: i, useCount: 1, refBit: 1, loadTime: i }); }
                    else {
                        let replaceIndex = -1;
                        if (algo === 'fifo') { let oTime = Infinity; frames.forEach((f, idx) => { if(f.loadTime < oTime) { oTime = f.loadTime; replaceIndex = idx; }}); }
                        else if (algo === 'lru') { let oUsed = Infinity; frames.forEach((f, idx) => { if(f.lastUsed < oUsed) { oUsed = f.lastUsed; replaceIndex = idx; }}); }
                        else if (algo === 'optimo') {
                            let farthest = -1;
                            frames.forEach((f, idx) => {
                                let nextUse = memRefs.slice(i+1).indexOf(f.page);
                                if (nextUse === -1) nextUse = Infinity;
                                if (nextUse > farthest) { farthest = nextUse; replaceIndex = idx; }
                            });
                        }
                        else if (algo === 'sc') {
                            let found = false;
                            while(!found) {
                                let oldest = Infinity; let curIdx = 0;
                                frames.forEach((f, idx) => { if(f.loadTime < oldest) { oldest = f.loadTime; curIdx = idx; }});
                                if (frames[curIdx].refBit === 1) { frames[curIdx].refBit = 0; frames[curIdx].loadTime = i; }
                                else { replaceIndex = curIdx; found = true; }
                            }
                        }
                        else if (algo === 'lfu') {
                            let lowestFreq = Infinity;
                            frames.forEach((f, idx) => { if(f.useCount < lowestFreq) { lowestFreq = f.useCount; replaceIndex = idx; }});
                        }
                        frames[replaceIndex] = { page: page, lastUsed: i, useCount: 1, refBit: 1, loadTime: i };
                    }
                }
            });
            return faults;
        }

        const memResults = [
            { label: 'FIFO', val: simularMem('fifo') },
            { label: 'LRU', val: simularMem('lru') },
            { label: 'Óptimo', val: simularMem('optimo') },
            { label: 'SC', val: simularMem('sc') },
            { label: 'LFU', val: simularMem('lfu') }
        ];

        // Disco
        const diskReqs = [98,183,37,122,14,124,65,67];
        const diskInit = 50;

        function simularDisk(algo) {
            let currentPos = diskInit; let totalSeek = 0; let pending = [...diskReqs];
            if (algo === 'fifo') {
                pending.forEach(r => { totalSeek += Math.abs(currentPos - r); currentPos = r; });
            } else if (algo === 'sstf') {
                while(pending.length > 0) {
                    let closestIdx = 0; let minDiff = Math.abs(currentPos - pending[0]);
                    for(let i=1; i<pending.length; i++) {
                        let diff = Math.abs(currentPos - pending[i]);
                        if (diff < minDiff) { minDiff = diff; closestIdx = i; }
                    }
                    totalSeek += minDiff; currentPos = pending[closestIdx]; pending.splice(closestIdx, 1);
                }
            } else if (algo === 'scan' || algo === 'cscan') {
                pending.push(diskInit); pending.sort((a,b) => a - b);
                let initIdx = pending.indexOf(diskInit);
                let up = pending.slice(initIdx + 1); let down = pending.slice(0, initIdx).reverse();
                let seqReqs = [];
                if (algo === 'scan') {
                    if (up.length > 0) up.push(199);
                    seqReqs = [...up, ...down];
                } else if (algo === 'cscan') {
                    if (up.length > 0) up.push(199);
                    if (down.length > 0) seqReqs = [...up, 0, ...down.reverse()];
                    else seqReqs = [...up];
                }
                seqReqs.forEach(r => { totalSeek += Math.abs(currentPos - r); currentPos = r; });
            }
            return totalSeek;
        }

        const diskResults = [
            { label: 'FIFO', val: simularDisk('fifo') },
            { label: 'SSTF', val: simularDisk('sstf') },
            { label: 'SCAN', val: simularDisk('scan') },
            { label: 'C-SCAN', val: simularDisk('cscan') }
        ];

        const memChart = document.getElementById('comp-mem-chart');
        memChart.innerHTML = '';
        memResults.forEach(d => {
            const col = document.createElement('div');
            col.className = 'bar-col';
            col.innerHTML = `
                <div class="bar" style="height: ${d.val * 15}px;">${d.val}</div>
                <div class="bar-label">${d.label}</div>
            `;
            memChart.appendChild(col);
        });

        const diskChart = document.getElementById('comp-disk-chart');
        diskChart.innerHTML = '';
        diskResults.forEach(d => {
            const col = document.createElement('div');
            col.className = 'bar-col';
            col.innerHTML = `
                <div class="bar" style="height: ${d.val * 0.4}px;">${d.val}</div>
                <div class="bar-label">${d.label}</div>
            `;
            diskChart.appendChild(col);
        });
    }
});
