/* =============================================
   NovelForge — Main App Logic
   ============================================= */

class NovelApp {
    constructor() {
        this.data = this.load();
        this.generating = false;
        this.init();
    }

    /* ---------- STORAGE ---------- */
    defaults() {
        return {
            apiKey: '',
            model: 'deepseek/deepseek-chat',
            customModel: '',
            jbPrompt: '',
            maxTokens: 4096,
            temperature: 0.8,
            characters: '',
            worldSetting: '',
            writingStyle: '',
            rollingSummary: '',
            novelSections: [],
        };
    }

    load() {
        try {
            const saved = localStorage.getItem('novelforge');
            return saved ? { ...this.defaults(), ...JSON.parse(saved) } : this.defaults();
        } catch { return this.defaults(); }
    }

    save() {
        localStorage.setItem('novelforge', JSON.stringify(this.data));
    }

    /* ---------- INIT ---------- */
    init() {
        document.getElementById('apiKey').value = this.data.apiKey;
        document.getElementById('modelSelect').value = this.data.model;
        document.getElementById('customModel').value = this.data.customModel;
        document.getElementById('jbPrompt').value = this.data.jbPrompt;
        document.getElementById('maxTokens').value = this.data.maxTokens;
        document.getElementById('temperature').value = this.data.temperature;
        document.getElementById('tempValue').textContent = this.data.temperature;
        document.getElementById('worldCharacters').value = this.data.characters;
        document.getElementById('worldSetting').value = this.data.worldSetting;
        document.getElementById('worldStyle').value = this.data.writingStyle;
        document.getElementById('rollingSummary').value = this.data.rollingSummary;

        if (this.data.model === 'custom') {
            document.getElementById('customModel').classList.remove('hidden');
        } else {
            document.getElementById('customModel').classList.add('hidden');
        }

        this.renderNovel();
        this.updateStats();
    }

    setupListeners() {
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            document.getElementById('customModel').classList.toggle('hidden', e.target.value !== 'custom');
        });
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = e.target.value;
        });
    }

    /* ---------- TABS ---------- */
    switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    }

    /* ---------- SAVE HANDLERS ---------- */
    saveSettings() {
        this.data.apiKey = document.getElementById('apiKey').value.trim();
        this.data.model = document.getElementById('modelSelect').value;
        this.data.customModel = document.getElementById('customModel').value.trim();
        this.data.jbPrompt = document.getElementById('jbPrompt').value;
        this.data.maxTokens = parseInt(document.getElementById('maxTokens').value) || 4096;
        this.data.temperature = parseFloat(document.getElementById('temperature').value) || 0.8;
        this.save();
        this.toast('Settings saved ✓');
    }

    saveWorld() {
        this.data.characters = document.getElementById('worldCharacters').value;
        this.data.worldSetting = document.getElementById('worldSetting').value;
        this.data.writingStyle = document.getElementById('worldStyle').value;
        this.save();
        this.toast('World saved ✓');
    }

    saveSummary() {
        this.data.rollingSummary = document.getElementById('rollingSummary').value;
        this.save();
        this.toast('Summary saved ✓');
    }

    /* ---------- CONTEXT BUILDER ---------- */
    buildMessages(userMessage) {
        const msgs = [];

        if (this.data.jbPrompt.trim()) {
            msgs.push({ role: 'system', content: this.data.jbPrompt });
        }

        let worldCtx = '';
        if (this.data.characters.trim()) worldCtx += `## CHARACTERS\n${this.data.characters}\n\n`;
        if (this.data.worldSetting.trim()) worldCtx += `## WORLD & SETTING\n${this.data.worldSetting}\n\n`;
        if (this.data.writingStyle.trim()) worldCtx += `## WRITING STYLE\n${this.data.writingStyle}\n\n`;

        if (worldCtx) {
            msgs.push({
                role: 'system',
                content: `You are a creative novelist. Here is the world you are writing in. Stay consistent with ALL details below:\n\n${worldCtx}`
            });
        }

        if (this.data.rollingSummary.trim()) {
            msgs.push({
                role: 'system',
                content: `## STORY SO FAR (Summary)\n${this.data.rollingSummary}`
            });
        }

        const recent = this.data.novelSections.slice(-2);
        if (recent.length > 0) {
            let recentText = recent.map(s => {
                let block = '';
                if (s.direction) block += `[Scene direction: ${s.direction}]\n`;
                block += s.text;
                return block;
            }).join('\n\n---\n\n');

            msgs.push({ role: 'assistant', content: recentText });
        }

        msgs.push({ role: 'user', content: userMessage });
        return msgs;
    }

    /* ---------- GENERATION ---------- */
    async generate(mode) {
        if (this.generating) return;
        if (!this.data.apiKey) {
            this.toast('Set your API key in ⚙️ Settings!');
            this.switchTab('settings');
            return;
        }

        const sceneInput = document.getElementById('sceneInput').value.trim();
        let userMsg;

        if (mode === 'scene' && sceneInput) {
            userMsg = `Continue the novel. Here is the scene direction: ${sceneInput}\n\nWrite the next section following this direction. Stay in character and maintain the established writing style.`;
        } else if (this.data.novelSections.length === 0) {
            userMsg = sceneInput
                ? `Begin the novel with this scene: ${sceneInput}\n\nWrite the opening section.`
                : 'Begin the novel. Write the opening section — Day 1.';
        } else {
            userMsg = sceneInput
                ? `Continue the novel. Direction: ${sceneInput}`
                : 'Continue the novel from where we left off. Write the next section naturally.';
        }

        const messages = this.buildMessages(userMsg);
        this.generating = true;
        this.setGenStatus(true, 'Generating...');
        this.disableControls(true);

        try {
            const model = this.data.model === 'custom' ? this.data.customModel : this.data.model;
            const response = await this.callAPI(messages, model);

            if (response) {
                this.data.novelSections.push({
                    text: response,
                    direction: sceneInput || null,
                    timestamp: Date.now()
                });
                document.getElementById('sceneInput').value = '';
                this.save();
                this.renderNovel();

                // Auto-save response to file
                this.autoSaveResponse(response, this.data.novelSections.length);

                // Auto-summarize using same model
                this.setGenStatus(true, 'Summarizing...');
                await this.autoSummarize(response, model);

                this.updateStats();
                this.toast('Section generated ✓');
            }
        } catch (err) {
            this.toast('Error: ' + err.message);
            console.error(err);
        } finally {
            this.generating = false;
            this.setGenStatus(false);
            this.disableControls(false);
        }
    }

    async callAPI(messages, model) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.data.apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'NovelForge'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: this.data.maxTokens,
                temperature: this.data.temperature,
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `API Error ${res.status}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    /* ---------- AUTO-SAVE RESPONSE TO FILE ---------- */
    autoSaveResponse(text, sectionNum) {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            const filename = `novel_section_${sectionNum}_${timestamp}.txt`;
            const blob = new Blob([`--- Section ${sectionNum} ---\n\n${text}`], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            console.warn('Auto-save failed:', err);
        }
    }

    /* ---------- AUTO-SUMMARIZE ---------- */
    async autoSummarize(newText, model) {
        try {
            const summaryPrompt = [
                {
                    role: 'system',
                    content: 'You are a concise summarizer. Summarize the following novel section in 3-5 sentences. Focus on: key events, character actions, emotional beats, and any plot developments. Be factual and brief.'
                },
                {
                    role: 'user',
                    content: `Summarize this section:\n\n${newText}`
                }
            ];

            const summary = await this.callAPI(summaryPrompt, model);
            if (summary) {
                const sectionNum = this.data.novelSections.length;
                const newEntry = `\n\n[Section ${sectionNum}] ${summary.trim()}`;
                this.data.rollingSummary = (this.data.rollingSummary + newEntry).trim();
                document.getElementById('rollingSummary').value = this.data.rollingSummary;
                this.save();
            }
        } catch (err) {
            console.warn('Auto-summarize failed:', err);
        }
    }

    /* ---------- RENDER NOVEL ---------- */
    renderNovel() {
        const output = document.getElementById('novelOutput');
        if (this.data.novelSections.length === 0) {
            output.innerHTML = `<div class="novel-empty">
                <div class="empty-icon">📖</div>
                <h3>Your Novel Starts Here</h3>
                <p>Set up your world in the 🌍 World tab, then come back and start writing!</p>
            </div>`;
            return;
        }

        output.innerHTML = this.data.novelSections.map((s, i) => {
            const dir = s.direction ? `<div class="section-direction">🎬 ${s.direction}</div>` : '';
            const meta = `<div class="section-meta">Section ${i + 1}</div>`;
            const text = s.text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
            return `<div class="novel-section">${meta}${dir}${text}</div>`;
        }).join('');

        output.scrollTop = output.scrollHeight;
    }

    /* ---------- UNDO ---------- */
    undoLast() {
        if (this.data.novelSections.length === 0) return;
        if (!confirm('Remove the last generated section?')) return;
        this.data.novelSections.pop();
        const lines = this.data.rollingSummary.split(/\n\n\[Section/);
        if (lines.length > 1) {
            lines.pop();
            this.data.rollingSummary = lines.join('\n\n[Section').trim();
            document.getElementById('rollingSummary').value = this.data.rollingSummary;
        }
        this.save();
        this.renderNovel();
        this.updateStats();
        this.toast('Last section removed');
    }

    /* ---------- EXPORT / IMPORT ---------- */
    exportNovel() {
        if (this.data.novelSections.length === 0) { this.toast('Nothing to export'); return; }
        const text = this.data.novelSections.map((s, i) => {
            let block = `--- Section ${i + 1} ---\n`;
            if (s.direction) block += `[Direction: ${s.direction}]\n\n`;
            block += s.text;
            return block;
        }).join('\n\n\n');
        this.downloadFile('novel_full.txt', text);
    }

    exportAll() {
        this.downloadFile('novelforge_backup.json', JSON.stringify(this.data, null, 2));
    }

    importAll(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                this.data = { ...this.defaults(), ...imported };
                this.save();
                this.init();
                this.toast('Project imported ✓');
            } catch { this.toast('Invalid file'); }
        };
        reader.readAsText(file);
        event.target.value = ''; // reset file input
    }

    downloadFile(name, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    /* ---------- CLEAR (FIXED) ---------- */
    clearNovel() {
        // Double-click safety instead of confirm()
        if (!this._clearNovelPending) {
            this._clearNovelPending = true;
            this.toast('Click again to confirm clear');
            setTimeout(() => { this._clearNovelPending = false; }, 3000);
            return;
        }
        this._clearNovelPending = false;
        this.data.novelSections = [];
        this.data.rollingSummary = '';
        document.getElementById('rollingSummary').value = '';
        this.save();
        this.renderNovel();
        this.updateStats();
        this.switchTab('novel');
        this.toast('Novel cleared ✓');
    }

    clearAll() {
        if (!this._clearAllPending) {
            this._clearAllPending = true;
            this.toast('⚠️ Click again to DELETE EVERYTHING');
            setTimeout(() => { this._clearAllPending = false; }, 3000);
            return;
        }
        this._clearAllPending = false;
        localStorage.removeItem('novelforge');
        this.data = this.defaults();
        // Reset all form fields manually
        document.getElementById('apiKey').value = '';
        document.getElementById('modelSelect').value = 'deepseek/deepseek-chat';
        document.getElementById('customModel').value = '';
        document.getElementById('customModel').classList.add('hidden');
        document.getElementById('jbPrompt').value = '';
        document.getElementById('maxTokens').value = 4096;
        document.getElementById('temperature').value = 0.8;
        document.getElementById('tempValue').textContent = '0.8';
        document.getElementById('worldCharacters').value = '';
        document.getElementById('worldSetting').value = '';
        document.getElementById('worldStyle').value = '';
        document.getElementById('rollingSummary').value = '';
        document.getElementById('sceneInput').value = '';
        this.save();
        this.renderNovel();
        this.updateStats();
        this.switchTab('novel');
        this.toast('Everything reset ✓');
    }

    /* ---------- CONTEXT PREVIEW ---------- */
    previewContext() {
        const msgs = this.buildMessages('[user message would go here]');
        const preview = document.getElementById('contextPreview');
        preview.classList.toggle('hidden');
        if (!preview.classList.contains('hidden')) {
            preview.textContent = msgs.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n' + '─'.repeat(40) + '\n\n');
        }
    }

    /* ---------- STATS ---------- */
    updateStats() {
        const totalWords = this.data.novelSections.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
        const sections = this.data.novelSections.length;
        const contextChars = (this.data.characters + this.data.worldSetting + this.data.writingStyle + this.data.rollingSummary + this.data.jbPrompt).length;
        const estTokens = Math.round(contextChars / 4);

        document.getElementById('statNovelWords').textContent = totalWords.toLocaleString() + ' words';
        document.getElementById('statChapters').textContent = sections;
        document.getElementById('statContext').textContent = `~${estTokens.toLocaleString()} tokens`;
    }

    /* ---------- UI HELPERS ---------- */
    setGenStatus(show, text) {
        const el = document.getElementById('genStatus');
        el.classList.toggle('hidden', !show);
        if (text) document.getElementById('genStatusText').textContent = text;
    }

    disableControls(disabled) {
        document.getElementById('btnContinue').disabled = disabled;
        document.getElementById('btnScene').disabled = disabled;
    }

    toast(msg) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
            padding:0.6rem 1.2rem;background:rgba(20,20,42,0.95);color:#e4e2f0;
            font-size:0.82rem;font-weight:600;border-radius:8px;z-index:999;
            border:1px solid rgba(167,139,250,0.3);box-shadow:0 4px 16px rgba(0,0,0,0.4);
            animation:fadeIn 0.3s ease;white-space:nowrap;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
}

const app = new NovelApp();
app.setupListeners();
