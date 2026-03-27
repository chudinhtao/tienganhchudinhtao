document.addEventListener('DOMContentLoaded', () => {
    // Current application state
    const state = {
        selectedPart: null,
        selectedTest: null,
        userAnswers: {},
        isSubmitted: false,
        isRandom: false,
        currentAnswerKey: {}, // qId -> answer mappings
        mixedTestItems: [],   // cached array of test blocks for the "mix" mode
        // One-by-one mode
        mode: 'all',          // 'all' | 'one'
        oboItems: [],         // flat list of items in obo mode
        oboIndex: 0,          // current item index
        oboScore: 0           // correct answers so far
    };

    // DOM Elements
    const elements = {
        partList: document.getElementById('part-list'),
        testList: document.getElementById('test-list'),
        testArea: document.getElementById('test-area'),
        currentTitle: document.getElementById('current-title'),
        progressBadge: document.getElementById('progress-badge'),
        btnSubmit: document.getElementById('btn-submit'),
        btnReset: document.getElementById('btn-reset'),
        btnNext: document.getElementById('btn-next'),
        modeBtnAll: document.getElementById('mode-btn-all'),
        modeBtnOne: document.getElementById('mode-btn-one'),
        modeSwitcher: document.getElementById('mode-switcher'),
        toggleRandom: document.getElementById('toggle-random'),
        menuToggle: document.getElementById('menu-toggle'),
        sidebar: document.querySelector('.sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay')
    };

    // Configuration
    const partsArray = [
        { id: 'overview', name: '📚 Cấu Trúc & Phương Pháp', available: true, isSpecial: true },
        { id: 'part1', name: 'Part 1: Photographs', available: true },
        { id: 'part2', name: 'Part 2: Question-Response', available: true },
        { id: 'part3', name: 'Part 3: Conversations', available: true },
        { id: 'part4', name: 'Part 4: Short Talks', available: true },
        { id: 'part5', name: 'Part 5: Incomplete Sentences', available: true },
        { id: 'part6', name: 'Part 6: Text Completion', available: true },
        { id: 'part7', name: 'Part 7: Reading Comprehension', available: true },
        { id: 'full', name: '🏆 Full Test (Thi thử toàn diện)', available: true, isSpecial: true },
        { id: 'mixed', name: 'Full Test (Random Mixed)', available: true, isSpecial: true }
    ];

    function shuffle(array) {
        let cur = array.length, rand;
        while (cur !== 0) {
            rand = Math.floor(Math.random() * cur);
            cur--;
            [array[cur], array[rand]] = [array[rand], array[cur]];
        }
        return array;
    }

    // Initialization
    function init() {
        renderParts();
        setupEventListeners();
        
        // Auto-select first available part
        const firstAvailable = partsArray.find(p => p.available);
        if (firstAvailable) {
            selectPart(firstAvailable.id);
        }
    }

    function renderParts() {
        elements.partList.innerHTML = '';
        partsArray.forEach(part => {
            const li = document.createElement('li');
            li.textContent = part.name;
            li.dataset.id = part.id;
            
            // Check if there is data for this part
            const isMixed = part.id === 'mixed';
            const isFull = part.id === 'full';
            const hasData = isMixed || isFull || (toeicData[part.id] && Object.keys(toeicData[part.id]).length > 0);
            
            if (!hasData && !part.available) {
                li.classList.add('disabled');
                li.title = "Coming soon";
            } else {
                if (part.isSpecial) li.style.fontWeight = "600";
                li.addEventListener('click', () => selectPart(part.id));
            }
            
            elements.partList.appendChild(li);
        });
    }

    function selectPart(partId) {
        state.selectedPart = partId;
        state.selectedTest = null;
        state.userAnswers = {};
        state.isSubmitted = false;

        // Update UI styles
        Array.from(elements.partList.children).forEach(li => {
            li.classList.toggle('active', li.dataset.id === partId);
        });

        renderTests();
        elements.testArea.innerHTML = `
            <div class="empty-state">
                <div class="icon">📖</div>
                <h3>${partsArray.find(p => p.id === partId).name}</h3>
                <p>Select a test from the menu to start practicing.</p>
            </div>
        `;
        elements.currentTitle.textContent = "Select a test";
        elements.progressBadge.classList.add('hidden');
        elements.btnSubmit.classList.add('hidden');
        elements.btnReset.classList.add('hidden');
    }

    function renderTests() {
        elements.testList.innerHTML = '';
        
        if (state.selectedPart === 'overview') {
            const li = document.createElement('li');
            li.textContent = "📖 Xem Cấu Trúc";
            li.dataset.id = "overview_read";
            li.style.fontWeight = "bold";
            li.style.color = "var(--primary)";
            li.addEventListener('click', () => selectTest("overview_read"));
            elements.testList.appendChild(li);
            return;
        }

        if (state.selectedPart === 'mixed') {
            const li = document.createElement('li');
            li.textContent = "Generate New Mixed Test";
            li.dataset.id = "random_mix";
            li.style.fontWeight = "bold";
            li.style.color = "var(--primary)";
            li.addEventListener('click', () => selectTest("random_mix"));
            elements.testList.appendChild(li);
            return;
        }

        if (state.selectedPart === 'full') {
            const testNames = new Set();
            for (let i = 1; i <= 7; i++) {
                const p = toeicData[`part${i}`];
                if (p) {
                    Object.keys(p).forEach(k => testNames.add(k));
                }
            }
            if (testNames.size === 0) {
                elements.testList.innerHTML = '<li class="disabled">No full tests available</li>';
                return;
            }
            Array.from(testNames).sort().forEach(testName => {
                const li = document.createElement('li');
                li.textContent = "Full Test - " + testName;
                li.dataset.id = testName;
                li.addEventListener('click', () => selectTest(testName));
                elements.testList.appendChild(li);
            });
            return;
        }

        const partData = toeicData[state.selectedPart];
        
        if (!partData || Object.keys(partData).length === 0) {
            elements.testList.innerHTML = '<li class="disabled">No tests available</li>';
            return;
        }

        Object.keys(partData).forEach(testName => {
            const li = document.createElement('li');
            li.textContent = testName;
            li.dataset.id = testName;
            li.addEventListener('click', () => selectTest(testName));
            elements.testList.appendChild(li);
        });
    }

    function selectTest(testName) {
        state.selectedTest = testName;
        state.userAnswers = {};
        state.isSubmitted = false;
        state.currentAnswerKey = {};

        // Update UI styles
        Array.from(elements.testList.children).forEach(li => {
            li.classList.toggle('active', li.dataset.id === testName);
        });

        if (state.selectedPart === 'overview') {
            elements.currentTitle.textContent = "Tổng quan & Phương pháp học TOEIC";
            elements.progressBadge.classList.add('hidden');
            elements.btnSubmit.classList.add('hidden');
            elements.btnReset.classList.add('hidden');
            elements.toggleRandom.parentElement.classList.add('hidden');
        } else if (state.selectedPart === 'mixed') {
            generateMixedTest();
            elements.currentTitle.textContent = "Mixed Practice Test (All Parts)";
            if (state.isRandom) {
                elements.currentTitle.textContent += " - Shuffled Sections";
            }
            elements.progressBadge.classList.remove('hidden');
            elements.btnSubmit.classList.remove('hidden');
            elements.btnReset.classList.remove('hidden');
            elements.toggleRandom.parentElement.classList.remove('hidden');
        } else if (state.selectedPart === 'full') {
            elements.currentTitle.textContent = `Full Test - ${testName}`;
            if (state.isRandom) {
                elements.currentTitle.textContent += " - Shuffled Sections";
            }
            elements.progressBadge.classList.remove('hidden');
            elements.btnSubmit.classList.remove('hidden');
            elements.btnReset.classList.remove('hidden');
            elements.toggleRandom.parentElement.classList.remove('hidden');
        } else {
            const partName = partsArray.find(p => p.id === state.selectedPart).name;
            elements.currentTitle.textContent = `${partName} - ${testName}`;
            elements.progressBadge.classList.remove('hidden');
            elements.btnSubmit.classList.remove('hidden');
            elements.btnReset.classList.remove('hidden');
            elements.toggleRandom.parentElement.classList.remove('hidden');
        }
        
        // In 'Làm từng câu' mode: show all questions but hide Submit
        if (state.mode === 'one' && state.selectedPart !== 'overview') {
            elements.btnSubmit.classList.add('hidden');
            elements.btnNext.classList.add('hidden');
        }
        renderTestContent();

        // On mobile, auto-close sidebar after selecting a test
        if (window.innerWidth <= 768) {
            elements.sidebar.classList.remove('open');
            elements.sidebarOverlay.classList.remove('open');
        }
    }

    // ─── ONE-BY-ONE MODE ─────────────────────────────────────────────────────

    function buildOboItems() {
        // Flatten ALL questions into individual items, each with optional passage context
        let flatItems = [];

        function addFromPartData(partData, partId, testName) {
            const isListening = ['part3','part4'].includes(partId);
            const data = partData[testName];
            if (!data) return;

            if (['part1', 'part2', 'part5'].includes(partId)) {
                data.forEach(q => {
                    flatItems.push({ q, passage: null, header: null, isListening: partId !== 'part5' });
                });
            } else {
                data.forEach(group => {
                    group.questions.forEach(q => {
                        flatItems.push({
                            q,
                            passage: group.passage,
                            header: group.header,
                            isListening
                        });
                    });
                });
            }
        }

        if (state.selectedPart === 'mixed') {
            state.mixedTestItems.forEach(item => {
                const isListening = item.isListening || false;
                if (item.type === 'single') {
                    flatItems.push({ q: item.data, passage: null, header: null, isListening: false });
                } else {
                    item.data.questions.forEach(q => {
                        flatItems.push({ q, passage: item.data.passage, header: item.data.header, isListening });
                    });
                }
            });
        } else if (state.selectedPart === 'full') {
            for (let i = 1; i <= 7; i++) {
                const partId = `part${i}`;
                if (toeicData[partId]) {
                    addFromPartData(toeicData[partId], partId, state.selectedTest);
                }
            }
        } else {
            addFromPartData(toeicData[state.selectedPart], state.selectedPart, state.selectedTest);
        }

        if (state.isRandom) shuffle(flatItems);
        return flatItems;
    }

    function startOboMode() {
        state.oboItems = buildOboItems();
        state.oboIndex = 0;
        state.oboScore = 0;
        state.userAnswers = {};
        state.currentAnswerKey = {};
        state.isSubmitted = false;
        renderOboQuestion();
        updateOboProgress();
    }

    function renderOboQuestion() {
        elements.testArea.innerHTML = '';
        const item = state.oboItems[state.oboIndex];
        if (!item) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'passage-card obo-current';

        // Show context header + passage if available
        if (item.header) {
            const hdr = document.createElement('div');
            hdr.className = 'passage-header';
            hdr.innerHTML = `<span style="color:var(--text-muted);font-size:13px;font-weight:500">Nhóm: ${item.header}</span>`;
            wrapper.appendChild(hdr);
        }
        if (item.passage) {
            const pt = document.createElement('div');
            pt.className = item.isListening ? 'passage-text listening-note' : 'passage-text';
            pt.textContent = item.passage;
            wrapper.appendChild(pt);
        }

        // Render single question (grouped style)
        const qEl = createQuestionHTML(item.q, state.oboIndex, !!item.passage);
        wrapper.appendChild(qEl);

        // Auto-reveal on selection
        wrapper.querySelectorAll('.option-input').forEach(radio => {
            radio.addEventListener('change', () => {
                setTimeout(() => oboRevealCurrent(), 120);
            });
        });

        elements.testArea.appendChild(wrapper);
        elements.btnNext.classList.add('hidden');
    }

    function oboRevealCurrent() {
        const item = state.oboItems[state.oboIndex];
        const qId = item.q.id;

        if (state.userAnswers[qId] === undefined) return;

        // Disable radios
        elements.testArea.querySelectorAll('.option-input').forEach(r => r.disabled = true);

        const uAns = state.userAnswers[qId];
        const cAns = state.currentAnswerKey[qId];
        const qCard = elements.testArea.querySelector(`[data-q-id="${qId}"]`);
        const expDiv = document.getElementById(`explain-${qId}`);

        if (cAns) {
            const correctLabel = qCard && qCard.querySelector(`.opt-${cAns}`);
            if (correctLabel) correctLabel.classList.add('correct');
        }

        if (uAns === cAns) {
            state.oboScore++;
            if (expDiv) { expDiv.textContent = '✅ Chính xác!'; expDiv.className = 'explanation correct-msg'; }
        } else {
            const wrongLabel = qCard && qCard.querySelector(`.opt-${uAns}`);
            if (wrongLabel) wrongLabel.classList.add('incorrect');
            if (expDiv) { expDiv.innerHTML = `❌ Sai. Đáp án đúng là <strong>${cAns}</strong>.`; expDiv.className = 'explanation incorrect-msg'; }
        }

        updateOboProgress();

        const total = state.oboItems.length;
        if (state.oboIndex < total - 1) {
            elements.btnNext.classList.remove('hidden');
            elements.btnNext.textContent = `Câu tiếp theo → (${state.oboIndex + 1}/${total})`;
        } else {
            setTimeout(oboFinish, 600);
        }
    }

    function oboNextQuestion() {
        state.oboIndex++;
        if (state.oboIndex < state.oboItems.length) {
            renderOboQuestion();
            updateOboProgress();
            window.scrollTo(0, 0);
        } else {
            oboFinish();
        }
    }

    function oboFinish() {
        elements.btnNext.classList.add('hidden');
        const total = state.oboItems.length;
        const correct = state.oboScore;
        const pct = total > 0 ? Math.round(correct / total * 100) : 0;
        const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

        elements.testArea.innerHTML = `
            <div class="obo-finish-banner">
                <h2>${emoji} Hoàn thành!</h2>
                <p>Bạn đúng <strong>${correct}/${total}</strong> câu — ${pct}%</p>
            </div>
        `;
        elements.progressBadge.textContent = `Kết quả: ${correct}/${total} (${pct}%)`;
        elements.progressBadge.style.backgroundColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? '#f59e0b' : 'var(--error)';
        elements.progressBadge.style.color = 'white';
    }

    function updateOboProgress() {
        const total = state.oboItems.length;
        const answered = Object.keys(state.userAnswers).length;
        elements.progressBadge.textContent = `${answered}/${total} Đã trả lời`;
        elements.progressBadge.classList.remove('hidden');
    }

    // ─────────────────────────────────────────────────────────────────────────

    function generateMixedTest() {
        let items = [];
        
        ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7'].forEach(pId => {
            const partData = toeicData[pId];
            if (!partData) return;
            const tests = Object.keys(partData);
            if (tests.length === 0) return;
            
            // Pick a random test from this part's catalog
            const randTest = tests[Math.floor(Math.random() * tests.length)];
            const tData = partData[randTest];
            
            if (['part1', 'part2', 'part5'].includes(pId)) {
                // Group each individual question so it can be shuffled independently
                tData.forEach(q => {
                    items.push({ type: 'single', data: q, originalPart: pId });
                });
            } else {
                // Keep passages grouped with its questions
                tData.forEach(passage => {
                    items.push({ type: 'passage', data: passage, originalPart: pId, isListening: ['part3', 'part4'].includes(pId) });
                });
            }
        });
        
        state.mixedTestItems = items;
    }

    function renderTestContent() {
        elements.testArea.innerHTML = '';
        state.currentAnswerKey = {}; // reset mapping
        
        if (state.selectedPart === 'overview') {
            elements.testArea.innerHTML = `
                <div class="passage-card">
                    <h2 class="passage-header" style="font-size: 24px; color: var(--primary); margin-bottom: 16px;">Tổng Quan Cấu Trúc Đề Thi TOEIC & Phương Pháp Học</h2>
                    <div class="passage-text" style="font-family: inherit;">
                        <p>Chào mừng bạn đến với phần Tổng quan. Đề thi TOEIC Listening & Reading bao gồm 200 câu hỏi trắc nghiệm chia làm 2 kỹ năng:</p>
                        <ul style="margin-left: 20px; margin-top: 10px; margin-bottom: 20px; line-height: 1.6;">
                            <li><strong>Phần Listening (100 câu / 45 phút):</strong> Part 1 (Mô tả tranh - 6 câu), Part 2 (Hỏi đáp - 25 câu), Part 3 (Hội thoại ngắn - 39 câu), Part 4 (Bài nói ngắn - 30 câu).</li>
                            <li><strong>Phần Reading (100 câu / 75 phút):</strong> Part 5 (Hoàn thành câu - 30 câu), Part 6 (Điền từ đoạn văn - 16 câu), Part 7 (Đọc hiểu - 54 câu bao gồm đoạn đơn, đoạn kép, đoạn ba).</li>
                        </ul>
                        <p>Dưới đây là một số sơ đồ cấu trúc từ vựng, ngữ pháp thiết yếu trích xuất từ tài liệu hướng dẫn:</p>
                        <br>
                        <img src="assets/image1.png" style="max-width: 100%; border-radius: 8px; margin-bottom: 24px; display: block; box-shadow: var(--shadow-sm);" alt="Sơ đồ kiến thức">
                        <img src="assets/image2.png" style="max-width: 100%; border-radius: 8px; margin-bottom: 24px; display: block; box-shadow: var(--shadow-sm);" alt="Thành phần câu">
                        <img src="assets/image3.png" style="max-width: 100%; border-radius: 8px; margin-bottom: 24px; display: block; box-shadow: var(--shadow-sm);" alt="Chức năng từ loại">
                        <br>
                        <p style="margin-top:20px; font-size: 18px; color: var(--primary);"><strong>💡 Phương pháp ôn tập nhanh tại nền tảng:</strong></p>
                        <ul style="margin-left: 20px; margin-top: 10px; line-height: 1.6;">
                            <li><strong>Part 5:</strong> Đọc lướt 4 đáp án trước để xác định dạng câu hỏi (ngữ pháp hay từ vựng). Với câu ngữ pháp, thường chỉ cần nhìn các từ nằm xung quanh chỗ trống. Hạn chế dịch cả câu gây mất thời gian.</li>
                            <li><strong>Part 6:</strong> Đọc lướt và hiểu ngữ cảnh cơ bản của đoạn văn. Đặc biệt chú ý câu trước và câu sau của vị trí trống cần điền một "câu hoàn chỉnh" (loại câu mới của Format nâng cấp).</li>
                            <li><strong>Part 7:</strong> Hãy dùng chiến thuật đọc câu hỏi trước để lấy từ khóa (Keyword), bỏ qua câu hỏi dễ gây nhiễu, sau đó Scanning để tìm đáp án. Từ khóa trong đoạn văn thường sẽ bị "Paraphrase" đi so với câu hỏi (đồng nghĩa).</li>
                            <li>Sử dụng chức năng <strong>Randomized Mixed Test</strong> của chúng tôi để tăng cường phản xạ làm bài và làm quen với việc xử lý thông tin ngẫu nhiên liên tục ở cường độ cao.</li>
                        </ul>
                    </div>
                </div>
            `;
            updateProgress();
            return;
        }

        let itemsToRender = [];
        
        if (state.selectedPart === 'mixed') {
            itemsToRender = [...state.mixedTestItems];
            if (state.isRandom) {
                // Randomize parts order and question order
                shuffle(itemsToRender);
            } else {
                // Order normally by Part 5 -> Part 6 -> Part 7
                itemsToRender.sort((a,b) => a.originalPart.localeCompare(b.originalPart));
            }
        } else if (state.selectedPart === 'full') {
            for (let i = 1; i <= 7; i++) {
                const partId = `part${i}`;
                const data = toeicData[partId];
                if (data && data[state.selectedTest]) {
                    const tData = data[state.selectedTest];
                    if (['part1', 'part2', 'part5'].includes(partId)) {
                        tData.forEach(q => itemsToRender.push({ type: 'single', data: q }));
                    } else if (partId === 'part3' || partId === 'part4') {
                        tData.forEach(p => itemsToRender.push({ type: 'passage', data: p, isListening: true }));
                    } else {
                        tData.forEach(p => itemsToRender.push({ type: 'passage', data: p }));
                    }
                }
            }
            if (state.isRandom) {
                shuffle(itemsToRender);
            }
        } else {
            const data = toeicData[state.selectedPart][state.selectedTest];
            if (['part1', 'part2', 'part5'].includes(state.selectedPart)) {
                data.forEach(q => itemsToRender.push({ type: 'single', data: q }));
            } else if (state.selectedPart === 'part3' || state.selectedPart === 'part4') {
                data.forEach(p => itemsToRender.push({ type: 'passage', data: p, isListening: true }));
            } else {
                data.forEach(p => itemsToRender.push({ type: 'passage', data: p }));
            }
            if (state.isRandom) {
                shuffle(itemsToRender);
            }
        }

        // Render Loop
        itemsToRender.forEach((item, index) => {
            if (item.type === 'single') {
                elements.testArea.appendChild(createQuestionHTML(item.data, index));
            } else if (item.type === 'passage') {
                const passageCard = document.createElement('div');
                passageCard.className = 'passage-card';
                
                const header = document.createElement('div');
                header.className = 'passage-header';
                header.textContent = item.data.header;
                passageCard.appendChild(header);

                const passageText = document.createElement('div');
                passageText.className = item.isListening ? 'passage-text listening-note' : 'passage-text';
                passageText.textContent = item.data.passage;
                passageCard.appendChild(passageText);

                item.data.questions.forEach((q, qIndex) => {
                    passageCard.appendChild(createQuestionHTML(q, `${index}-${qIndex}`, true));
                });
                
                elements.testArea.appendChild(passageCard);
            }
        });

        updateProgress();
    }


    function createQuestionHTML(qData, uniqueId, isGrouped = false) {
        // Collect answer key
        state.currentAnswerKey[qData.id] = qData.answer;

        const container = document.createElement('div');
        container.className = isGrouped ? 'question-grouped' : 'question-card';
        if (isGrouped) container.style.marginTop = "24px";
        
        container.dataset.qId = qData.id;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'q-header';
        
        const numDiv = document.createElement('div');
        numDiv.className = 'q-number';
        numDiv.textContent = `${qData.id}.`;
        
        const textDiv = document.createElement('div');
        textDiv.className = 'q-text';
        textDiv.textContent = qData.question || "Choose the best answer.";
        
        headerDiv.appendChild(numDiv);
        headerDiv.appendChild(textDiv);
        container.appendChild(headerDiv);

        if (qData.image) {
            const imgEl = document.createElement('img');
            imgEl.src = qData.image;
            imgEl.style.maxWidth = '100%';
            imgEl.style.maxHeight = '300px';
            imgEl.style.objectFit = 'contain';
            imgEl.style.borderRadius = '8px';
            imgEl.style.marginTop = '15px';
            imgEl.style.marginBottom = '15px';
            container.appendChild(imgEl);
        }

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options';

        Object.entries(qData.options).forEach(([letter, text]) => {
            const label = document.createElement('label');
            label.className = `option-label opt-${letter}`;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `question-${qData.id}`;
            input.value = letter;
            input.className = 'option-input';
            
            input.addEventListener('change', () => {
                if(state.isSubmitted) return;
                state.userAnswers[qData.id] = letter;
                
                // Update selection visual
                const allLabels = optionsDiv.querySelectorAll('.option-label');
                allLabels.forEach(l => l.classList.remove('selected'));
                label.classList.add('selected');
                
                updateProgress();

                // In 'Làm từng câu' mode: reveal answer immediately
                if (state.mode === 'one') {
                    const cAns = state.currentAnswerKey[qData.id];
                    // Disable all options for this question
                    container.querySelectorAll('.option-input').forEach(r => r.disabled = true);
                    // Highlight correct answer
                    if (cAns) {
                        const correctLabel = container.querySelector(`.opt-${cAns}`);
                        if (correctLabel) correctLabel.classList.add('correct');
                    }
                    const expDiv = document.getElementById(`explain-${qData.id}`);
                    if (letter === cAns) {
                        if (expDiv) { expDiv.textContent = '\u2705 Ch\u00ednh x\u00e1c!'; expDiv.className = 'explanation correct-msg'; }
                    } else {
                        label.classList.add('incorrect');
                        if (expDiv) { expDiv.innerHTML = `\u274c Sai. \u0110\u00e1p \u00e1n \u0111\u00fang l\u00e0 <strong>${cAns}</strong>.`; expDiv.className = 'explanation incorrect-msg'; }
                    }
                }
            });

            const customRadio = document.createElement('div');
            customRadio.className = 'radio-custom';

            const txtSpan = document.createElement('span');
            txtSpan.className = 'option-text';
            txtSpan.textContent = `(${letter}) ${text}`;

            label.appendChild(input);
            label.appendChild(customRadio);
            label.appendChild(txtSpan);
            optionsDiv.appendChild(label);
        });

        container.appendChild(optionsDiv);
        
        // Explanation / Result block
        const expDiv = document.createElement('div');
        expDiv.className = 'explanation';
        expDiv.id = `explain-${qData.id}`;
        container.appendChild(expDiv);

        // Warning if no answer in DB
        if (!qData.answer) {
            const warn = document.createElement('div');
            warn.className = 'no-answer-warning';
            warn.textContent = "* Answer key not provided in source text, self-evaluation required.";
            container.appendChild(warn);
        }

        return container;
    }

    function updateProgress() {
        const total = Object.keys(state.currentAnswerKey).length;
        const answered = Object.keys(state.userAnswers).length;
        elements.progressBadge.textContent = `${answered}/${total} Answered`;
        
        if(answered === total && total > 0) {
            elements.progressBadge.style.backgroundColor = 'var(--success-light)';
            elements.progressBadge.style.color = 'var(--success)';
        } else {
            elements.progressBadge.style.backgroundColor = 'var(--primary-light)';
            elements.progressBadge.style.color = 'var(--primary)';
        }
    }

    function submitAnswers() {
        if(state.isSubmitted) return;
        state.isSubmitted = true;
        
        let correctCount = 0;
        let validTotal = 0;

        Object.keys(state.currentAnswerKey).forEach(qId => {
            const uAnswer = state.userAnswers[qId];
            const cAnswer = state.currentAnswerKey[qId];
            
            if (cAnswer) validTotal++;

            const expDiv = document.getElementById(`explain-${qId}`);
            const questionCard = document.querySelector(`[data-q-id="${qId}"]`);
            if(!questionCard) return;

            // Mark correct answer
            if (cAnswer) {
                const correctLabel = questionCard.querySelector(`.opt-${cAnswer}`);
                if(correctLabel) correctLabel.classList.add('correct');
            }

            if (cAnswer !== null) {
                if (uAnswer === cAnswer) {
                    correctCount++;
                    expDiv.textContent = "Correct!";
                    expDiv.className = "explanation correct-msg";
                } else if (uAnswer) {
                    const incorrectLabel = questionCard.querySelector(`.opt-${uAnswer}`);
                    if(incorrectLabel) incorrectLabel.classList.add('incorrect');
                    
                    expDiv.innerHTML = `Incorrect. The correct answer is <strong>${cAnswer}</strong>.`;
                    expDiv.className = "explanation incorrect-msg";
                } else {
                    expDiv.innerHTML = `Not answered. The correct answer is <strong>${cAnswer}</strong>.`;
                    expDiv.className = "explanation incorrect-msg";
                }
            } else {
                 if (uAnswer) {
                    expDiv.innerHTML = `Recorded. Unscored.`;
                    expDiv.className = "explanation";
                }   
            }
        });

        // Use validTotal for score to not penalize missing answer keys
        elements.progressBadge.textContent = `Score: ${correctCount}/${validTotal} (Graded)`;
        if(validTotal > 0) {
            let percentage = (correctCount/validTotal)*100;
            if (percentage >= 80) {
                 elements.progressBadge.style.backgroundColor = 'var(--success)';
            } else if (percentage >= 50) {
                 elements.progressBadge.style.backgroundColor = '#f59e0b'; // warning
            } else {
                 elements.progressBadge.style.backgroundColor = 'var(--danger)'; 
            }
        }
        elements.progressBadge.style.color = 'white';
        window.scrollTo(0, 0);
    }

    function resetTest() {
        if(confirm("Are you sure you want to reset your answers?")) {
            selectTest(state.selectedTest);
        }
    }

    function setupEventListeners() {
        elements.btnSubmit.addEventListener('click', submitAnswers);
        elements.btnReset.addEventListener('click', resetTest);
        elements.btnNext.addEventListener('click', oboNextQuestion);

        // Sidebar Toggle for Mobile
        if(elements.menuToggle) {
            elements.menuToggle.addEventListener('click', () => {
                elements.sidebar.classList.toggle('open');
                elements.sidebarOverlay.classList.toggle('open');
            });
        }
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.addEventListener('click', () => {
                elements.sidebar.classList.remove('open');
                elements.sidebarOverlay.classList.remove('open');
            });
        }

        // Mode switcher
        elements.modeBtnAll.addEventListener('click', () => {
            if (state.mode === 'all') return;
            state.mode = 'all';
            elements.modeBtnAll.classList.add('active');
            elements.modeBtnOne.classList.remove('active');
            elements.btnSubmit.classList.remove('hidden');
            elements.btnNext.classList.add('hidden');
            if (state.selectedTest) selectTest(state.selectedTest);
        });

        elements.modeBtnOne.addEventListener('click', () => {
            if (state.mode === 'one') return;
            state.mode = 'one';
            elements.modeBtnOne.classList.add('active');
            elements.modeBtnAll.classList.remove('active');
            elements.btnSubmit.classList.add('hidden');
            elements.btnNext.classList.add('hidden');
            if (state.selectedTest && state.selectedPart !== 'overview') {
                selectTest(state.selectedTest);
            }
        });
        
        elements.toggleRandom.addEventListener('change', (e) => {
            state.isRandom = e.target.checked;
            
            if (state.selectedTest !== null) {
                // Determine title based on modes
                if (state.selectedPart === 'mixed') {
                    elements.currentTitle.textContent = "Mixed Practice Test (All Parts)" + (state.isRandom ? " - Shuffled Sections" : "");
                } else if (state.selectedPart === 'full') {
                    elements.currentTitle.textContent = "Full Test - " + state.selectedTest + (state.isRandom ? " - Shuffled Sections" : "");
                }
                
                // Keep user answers but re-render structure
                const oldAnswers = {...state.userAnswers};
                const oldSubmitted = state.isSubmitted;
                
                // Re-render
                renderTestContent();
                
                // Restore answers visually
                state.userAnswers = oldAnswers;
                state.isSubmitted = oldSubmitted;
                
                Object.entries(state.userAnswers).forEach(([qId, letter]) => {
                    const qCard = document.querySelector(`[data-q-id="${qId}"]`);
                    if (qCard) {
                        const input = qCard.querySelector(`input[value="${letter}"]`);
                        if (input) {
                            input.checked = true;
                            qCard.querySelector(`.opt-${letter}`).classList.add('selected');
                        }
                    }
                });
                
                // Rescore if already submitted
                if (state.isSubmitted) {
                    state.isSubmitted = false;
                    submitAnswers();
                } else {
                    updateProgress();
                }
            }
        });
    }

    // Start App
    init();
});
