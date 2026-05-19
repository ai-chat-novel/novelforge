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
            provider: 'openrouter',
            apiKey: '',
            apiKeyNvidia: '',
            apiKeyCustom: '',
            proxyUrl: '',
            customBaseUrl: '',
            model: 'deepseek/deepseek-v4-flash:free',
            customModel: '',
            jbPrompt: '',
            maxTokens: 8192,
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
        // Provider toggle
        this.switchProvider(this.data.provider, true);

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

    /* ---------- PROVIDER TOGGLE ---------- */
    switchProvider(provider, silent) {
        this.data.provider = provider;
        const isNvidia = provider === 'nvidia';
        const isCustom = provider === 'custom';
        const isOpenRouter = provider === 'openrouter';

        // Toggle button styles
        document.getElementById('provOpenRouter').classList.toggle('active', isOpenRouter);
        document.getElementById('provNvidia').classList.toggle('active', isNvidia);
        document.getElementById('provCustom').classList.toggle('active', isCustom);

        // Update API key field
        const keyField = document.getElementById('apiKey');
        const keyLabel = document.getElementById('apiKeyLabel');
        if (isNvidia) {
            keyLabel.textContent = '🔑 NVIDIA API Key';
            keyField.placeholder = 'nvapi-xxxxxxxxxxxx';
            keyField.value = this.data.apiKeyNvidia;
        } else if (isCustom) {
            keyLabel.textContent = '🔑 API Key';
            keyField.placeholder = 'your-api-key-here';
            keyField.value = this.data.apiKeyCustom;
        } else {
            keyLabel.textContent = '🔑 OpenRouter API Key';
            keyField.placeholder = 'sk-or-v1-xxxxxxxxxxxx';
            keyField.value = this.data.apiKey;
        }

        // Show/hide custom base URL field
        document.getElementById('customBaseUrlGroup').classList.toggle('hidden', !isCustom);
        if (isCustom) {
            document.getElementById('customBaseUrl').value = this.data.customBaseUrl;
        }

        // Show/hide proxy URL field (NVIDIA + Custom need it)
        document.getElementById('proxyUrlGroup').classList.toggle('hidden', isOpenRouter);
        if (!isOpenRouter) {
            document.getElementById('proxyUrl').value = this.data.proxyUrl;
        }

        // Toggle model optgroups vs custom model input
        document.getElementById('ogOpenRouter').classList.toggle('hidden', !isOpenRouter);
        document.getElementById('ogNvidia').classList.toggle('hidden', !isNvidia);
        document.getElementById('modelSelect').classList.toggle('hidden', isCustom);
        document.getElementById('customModel').classList.toggle('hidden', !isCustom);
        if (isCustom) {
            document.getElementById('customModel').value = this.data.customModel;
        }

        // Auto-select first model of the active provider
        if (!silent && !isCustom) {
            const firstOption = document.querySelector(`#${isNvidia ? 'ogNvidia' : 'ogOpenRouter'} option`);
            if (firstOption) document.getElementById('modelSelect').value = firstOption.value;
        }
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
        const provider = this.data.provider;
        const keyVal = document.getElementById('apiKey').value.trim();
        if (provider === 'nvidia') {
            this.data.apiKeyNvidia = keyVal;
        } else if (provider === 'custom') {
            this.data.apiKeyCustom = keyVal;
            this.data.customBaseUrl = document.getElementById('customBaseUrl').value.trim();
            this.data.customModel = document.getElementById('customModel').value.trim();
        } else {
            this.data.apiKey = keyVal;
        }
        // Proxy URL shared by NVIDIA + Custom
        if (provider !== 'openrouter') {
            this.data.proxyUrl = document.getElementById('proxyUrl').value.trim();
        }
        if (provider !== 'custom') {
            this.data.model = document.getElementById('modelSelect').value;
        }
        this.data.jbPrompt = document.getElementById('jbPrompt').value;
        this.data.maxTokens = parseInt(document.getElementById('maxTokens').value) || 8192;
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

        // Anti-repetition directive
        msgs.push({
            role: 'system',
            content: `CRITICAL WRITING RULES:\n- NEVER repeat dialogue, phrases, or scenes from previous sections.\n- NEVER use the phrase "one day at a time" again.\n- NEVER reuse the same scene structure (e.g. mess hall lunch → library study → dorm sleep).\n- Each section MUST introduce NEW events, NEW conversations, NEW character dynamics.\n- Advance the plot forward. Show new classes, new interactions, new incidents.\n- If previous sections covered lunch/library/dorm, the next section must show DIFFERENT activities.\n- Vary sentence structure, dialogue, and descriptions. No templates.\n- NEVER add "Notes for Continuity" or meta-commentary. You are writing the novel, not commenting on it.\n- NEVER say "Let me know if you'd like to adjust" — just write the story.\n- Sex/intimate scenes: Write with full anatomical detail using explicit words (cock, pussy, nipple, clit, etc). Never use euphemisms like "her entrance" or "his length". Describe physical sensations, fluids, skin contact, body reactions realistically. Never fade to black or skip over details.`
        });

        if (this.data.rollingSummary.trim()) {
            msgs.push({
                role: 'system',
                content: `## STORY SO FAR (Summary)\n${this.data.rollingSummary}`
            });
        }

        // Recent sections — truncate each to ~2000 chars to save context
        const recent = this.data.novelSections.slice(-2);
        if (recent.length > 0) {
            let recentText = recent.map(s => {
                let block = '';
                if (s.direction) block += `[Scene direction: ${s.direction}]\n`;
                let text = s.text;
                // Truncate long sections — keep last 2000 chars
                if (text.length > 2000) {
                    text = '... [earlier content truncated] ...\n\n' + text.slice(-2000);
                }
                block += text;
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
        const p = this.data.provider;
        const activeKey = p === 'nvidia' ? this.data.apiKeyNvidia : p === 'custom' ? this.data.apiKeyCustom : this.data.apiKey;
        if (!activeKey) {
            this.toast('Set your API key in ⚙️ Settings!');
            this.switchTab('settings');
            return;
        }

        const sceneInput = document.getElementById('sceneInput').value.trim();
        let userMsg;

        if (mode === 'scene' && sceneInput) {
            userMsg = `Continue the novel. Here is the scene direction: ${sceneInput}\n\nWrite the next section following this direction. Stay in character and maintain the established writing style. DO NOT repeat any previous scenes or dialogue.`;
        } else if (this.data.novelSections.length === 0) {
            userMsg = sceneInput
                ? `Begin the novel with this scene: ${sceneInput}\n\nWrite the opening section.`
                : 'Begin the novel. Write the opening section — Day 1.';
        } else {
            // Smarter continue prompt that pushes plot forward
            const sectionCount = this.data.novelSections.length;
            userMsg = sceneInput
                ? `Continue the novel. Direction: ${sceneInput}\n\nDo NOT repeat any previous scenes. Introduce new events and conversations.`
                : `Continue the novel from where we left off. This is section ${sectionCount + 1}.\n\nIMPORTANT: Write a COMPLETELY NEW scene that has NOT appeared before. Advance the plot. Introduce a new event, a new conversation topic, or a new character interaction. DO NOT reuse any dialogue or scene structure from previous sections. Show something the reader hasn't seen yet.`;
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
        const provider = this.data.provider;
        let targetUrl, apiKey;

        if (provider === 'nvidia') {
            targetUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
            apiKey = this.data.apiKeyNvidia;
        } else if (provider === 'custom') {
            targetUrl = this.data.customBaseUrl;
            apiKey = this.data.apiKeyCustom;
            model = this.data.customModel || model;
            if (!targetUrl) throw new Error('Set your Custom API Base URL in Settings!');
            // Ensure URL ends with /chat/completions
            if (!targetUrl.includes('/chat/completions')) {
                targetUrl = targetUrl.replace(/\/$/, '') + '/chat/completions';
            }
        } else {
            // OpenRouter — direct, no proxy needed
            targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
            apiKey = this.data.apiKey;
        }

        const bodyObj = {
            model: model,
            messages: messages,
            max_tokens: this.data.maxTokens,
            temperature: this.data.temperature,
        };
        // NVIDIA NIM: enable thinking to prevent timeout
        if (provider === 'nvidia') {
            bodyObj.chat_template_kwargs = { enable_thinking: true, thinking: true };
        }

        let fetchUrl, headers;

        if (provider === 'openrouter') {
            // Direct call — OpenRouter supports CORS
            fetchUrl = targetUrl;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'NovelForge',
            };
        } else {
            // Route through proxy (local or Cloudflare Worker)
            fetchUrl = this.data.proxyUrl || '/proxy/nvidia';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            };
            // Pass target URL inside the body for the proxy
            bodyObj._proxyTarget = targetUrl;
        }

        const res = await fetch(fetchUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyObj)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || err.detail || `API Error ${res.status}`);
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
    parseMd(text) {
        // Parse markdown: **bold**, *italic*, escape HTML first
        let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Bold: **text**
        safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic: *text*
        safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Horizontal rules: --- or ***
        safe = safe.replace(/^(---|\*\*\*)$/gm, '<hr>');
        return safe;
    }

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
            const text = s.text.split('\n').filter(p => p.trim()).map(p => `<p>${this.parseMd(p)}</p>`).join('');
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
