document.addEventListener('DOMContentLoaded', () => {
    // Current application state
    const state = {
        selectedPart: null,
        selectedTest: null,
        userAnswers: {},
        isSubmitted: false,
        isRandom: false,
        currentAnswerKey: {}, // qId -> answer mappings
        mixedTestItems: []    // cached array of test blocks for the "mix" mode
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
        toggleRandom: document.getElementById('toggle-random')
    };

    // Configuration
    const partsArray = [
        { id: 'overview', name: '📚 Cấu Trúc & Phương Pháp', available: true, isSpecial: true },
        { id: 'part1', name: 'Part 1: Photographs', available: false },
        { id: 'part2', name: 'Part 2: Question-Response', available: false },
        { id: 'part3', name: 'Part 3: Conversations', available: true },
        { id: 'part4', name: 'Part 4: Short Talks', available: true },
        { id: 'part5', name: 'Part 5: Incomplete Sentences', available: true },
        { id: 'part6', name: 'Part 6: Text Completion', available: true },
        { id: 'part7', name: 'Part 7: Reading Comprehension', available: true },
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
            const hasData = isMixed || (toeicData[part.id] && Object.keys(toeicData[part.id]).length > 0);
            
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
        } else {
            const partName = partsArray.find(p => p.id === state.selectedPart).name;
            elements.currentTitle.textContent = `${partName} - ${testName}`;
            elements.progressBadge.classList.remove('hidden');
            elements.btnSubmit.classList.remove('hidden');
            elements.btnReset.classList.remove('hidden');
            elements.toggleRandom.parentElement.classList.remove('hidden');
        }
        
        renderTestContent();
    }

    function generateMixedTest() {
        let items = [];
        
        ['part5', 'part6', 'part7'].forEach(pId => {
            const partData = toeicData[pId];
            if (!partData) return;
            const tests = Object.keys(partData);
            if (tests.length === 0) return;
            
            // Pick a random test from this part's catalog
            const randTest = tests[Math.floor(Math.random() * tests.length)];
            const tData = partData[randTest];
            
            if (pId === 'part5') {
                // Group each individual question so it can be shuffled independently
                tData.forEach(q => {
                    items.push({ type: 'single', data: q, originalPart: pId });
                });
            } else {
                // Keep passages grouped with its questions
                tData.forEach(passage => {
                    items.push({ type: 'passage', data: passage, originalPart: pId });
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
        } else {
            const data = toeicData[state.selectedPart][state.selectedTest];
            if (state.selectedPart === 'part5') {
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
        
        elements.toggleRandom.addEventListener('change', (e) => {
            state.isRandom = e.target.checked;
            
            if (state.selectedTest !== null) {
                // Determine title based on modes
                if (state.selectedPart === 'mixed') {
                    elements.currentTitle.textContent = "Mixed Practice Test (All Parts)" + (state.isRandom ? " - Shuffled Sections" : "");
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
