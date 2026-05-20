/* =============================================
   NovelForge — Main App Logic (v5 - Profiles)
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
            // Profiles system
            apiProfiles: [
                { id: 'or-free', name: 'OpenRouter Free', provider: 'openrouter', apiKey: '', model: 'deepseek/deepseek-v4-flash:free', baseUrl: '', proxyUrl: '' },
            ],
            activeWriteProfile: 'or-free',
            activeSummaryProfile: 'or-free',
            // Global settings
            jbPrompt: '',
            maxTokens: 8192,
            temperature: 0.8,
            // World
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
            if (!saved) return this.defaults();
            const parsed = { ...this.defaults(), ...JSON.parse(saved) };
            // Migration: if old format (no apiProfiles), create profiles from old data
            if (!parsed.apiProfiles || parsed.apiProfiles.length === 0) {
                parsed.apiProfiles = this.defaults().apiProfiles;
                // Migrate old API key if present
                if (parsed.apiKey) {
                    parsed.apiProfiles[0].apiKey = parsed.apiKey;
                }
            }
            return parsed;
        } catch { return this.defaults(); }
    }

    save() {
        localStorage.setItem('novelforge', JSON.stringify(this.data));
    }

    /* ---------- PROFILE HELPERS ---------- */
    getProfile(id) {
        return this.data.apiProfiles.find(p => p.id === id);
    }

    getWriteProfile() {
        return this.getProfile(this.data.activeWriteProfile) || this.data.apiProfiles[0];
    }

    getSummaryProfile() {
        return this.getProfile(this.data.activeSummaryProfile) || this.data.apiProfiles[0];
    }

    /* ---------- INIT ---------- */
    init() {
        // Populate profile dropdowns
        this.renderProfileDropdowns();
        this.renderProfileCards();

        // Global settings
        document.getElementById('jbPrompt').value = this.data.jbPrompt;
        document.getElementById('maxTokens').value = this.data.maxTokens;
        document.getElementById('temperature').value = this.data.temperature;
        document.getElementById('tempValue').textContent = this.data.temperature;

        // World
        document.getElementById('worldCharacters').value = this.data.characters;
        document.getElementById('worldSetting').value = this.data.worldSetting;
        document.getElementById('worldStyle').value = this.data.writingStyle;
        document.getElementById('rollingSummary').value = this.data.rollingSummary;

        this.renderNovel();
        this.updateStats();

        // Listeners
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = e.target.value;
        });
    }

    /* ---------- PROFILE UI ---------- */
    renderProfileDropdowns() {
        const writeSelect = document.getElementById('writeProfile');
        const summarySelect = document.getElementById('summaryProfile');
        const opts = this.data.apiProfiles.map(p => {
            const icon = p.provider === 'openrouter' ? '⚡' : p.provider === 'nvidia' ? '🟢' : '🔗';
            return `<option value="${p.id}">${icon} ${p.name} (${p.model})</option>`;
        }).join('');
        writeSelect.innerHTML = opts;
        summarySelect.innerHTML = opts;
        writeSelect.value = this.data.activeWriteProfile;
        summarySelect.value = this.data.activeSummaryProfile;
    }

    renderProfileCards() {
        const container = document.getElementById('profileCards');
        if (this.data.apiProfiles.length === 0) {
            container.innerHTML = '<p class="field-hint" style="text-align:center;padding:1rem">No profiles yet. Add one!</p>';
            return;
        }
        container.innerHTML = this.data.apiProfiles.map(p => {
            const icon = p.provider === 'openrouter' ? '⚡' : p.provider === 'nvidia' ? '🟢' : '🔗';
            const isWrite = p.id === this.data.activeWriteProfile;
            const isSummary = p.id === this.data.activeSummaryProfile;
            const badges = [];
            if (isWrite) badges.push('<span class="badge badge-write">✍️ Write</span>');
            if (isSummary) badges.push('<span class="badge badge-summary">📋 Summary</span>');
            const keyPreview = p.apiKey ? '••••' + p.apiKey.slice(-4) : '⚠️ No key';
            return `
                <div class="profile-card">
                    <div class="pc-header">
                        <span class="pc-icon">${icon}</span>
                        <span class="pc-name">${p.name}</span>
                        ${badges.join('')}
                    </div>
                    <div class="pc-details">
                        <span class="pc-model">${p.model}</span>
                        <span class="pc-key">${keyPreview}</span>
                    </div>
                    <div class="pc-actions">
                        <button class="btn btn-ghost btn-sm" onclick="app.editProfile('${p.id}')">✏️ Edit</button>
                        <button class="btn btn-ghost btn-sm" onclick="app.deleteProfile('${p.id}')" ${this.data.apiProfiles.length <= 1 ? 'disabled' : ''}>🗑️</button>
                    </div>
                </div>`;
        }).join('');
    }

    showProfileEditor(profileId) {
        const editor = document.getElementById('profileEditor');
        editor.classList.remove('hidden');
        if (profileId) {
            const p = this.getProfile(profileId);
            document.getElementById('profileEditorTitle').textContent = 'Edit Profile';
            document.getElementById('peId').value = p.id;
            document.getElementById('peName').value = p.name;
            document.getElementById('peProvider').value = p.provider;
            document.getElementById('peKey').value = p.apiKey;
            document.getElementById('peBaseUrl').value = p.baseUrl || '';
            document.getElementById('peProxy').value = p.proxyUrl || '';
            document.getElementById('peModel').value = p.model;
        } else {
            document.getElementById('profileEditorTitle').textContent = 'New Profile';
            document.getElementById('peId').value = '';
            document.getElementById('peName').value = '';
            document.getElementById('peProvider').value = 'openrouter';
            document.getElementById('peKey').value = '';
            document.getElementById('peBaseUrl').value = '';
            document.getElementById('peProxy').value = '';
            document.getElementById('peModel').value = '';
        }
        this.onProfileProviderChange();
    }

    hideProfileEditor() {
        document.getElementById('profileEditor').classList.add('hidden');
    }

    editProfile(id) {
        this.showProfileEditor(id);
    }

    deleteProfile(id) {
        if (this.data.apiProfiles.length <= 1) return;
        this.data.apiProfiles = this.data.apiProfiles.filter(p => p.id !== id);
        // Fix active selections if deleted
        if (this.data.activeWriteProfile === id) this.data.activeWriteProfile = this.data.apiProfiles[0].id;
        if (this.data.activeSummaryProfile === id) this.data.activeSummaryProfile = this.data.apiProfiles[0].id;
        this.save();
        this.renderProfileCards();
        this.renderProfileDropdowns();
        this.toast('Profile deleted');
    }

    onProfileProviderChange() {
        const provider = document.getElementById('peProvider').value;
        const needsProxy = provider !== 'openrouter';
        const needsBaseUrl = provider === 'custom';
        document.getElementById('peBaseUrlGroup').classList.toggle('hidden', !needsBaseUrl);
        document.getElementById('peProxyGroup').classList.toggle('hidden', !needsProxy);
    }

    saveProfile() {
        const name = document.getElementById('peName').value.trim();
        const provider = document.getElementById('peProvider').value;
        const apiKey = document.getElementById('peKey').value.trim();
        const model = document.getElementById('peModel').value.trim();
        const baseUrl = document.getElementById('peBaseUrl').value.trim();
        const proxyUrl = document.getElementById('peProxy').value.trim();

        if (!name || !model) {
            this.toast('Name and Model are required!');
            return;
        }

        const existingId = document.getElementById('peId').value;
        if (existingId) {
            // Update existing
            const p = this.getProfile(existingId);
            if (p) {
                p.name = name; p.provider = provider; p.apiKey = apiKey;
                p.model = model; p.baseUrl = baseUrl; p.proxyUrl = proxyUrl;
            }
        } else {
            // Create new
            const id = 'p_' + Date.now();
            this.data.apiProfiles.push({ id, name, provider, apiKey, model, baseUrl, proxyUrl });
        }

        this.save();
        this.hideProfileEditor();
        this.renderProfileCards();
        this.renderProfileDropdowns();
        this.toast('Profile saved ✓');
    }

    /* ---------- TABS ---------- */
    switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    }

    /* ---------- SAVE HANDLERS ---------- */
    saveGlobalSettings() {
        this.data.jbPrompt = document.getElementById('jbPrompt').value;
        this.data.maxTokens = parseInt(document.getElementById('maxTokens').value) || 8192;
        this.data.temperature = parseFloat(document.getElementById('temperature').value) || 0.8;
        this.save();
        this.toast('Global settings saved ✓');
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
        const profile = this.getWriteProfile();
        if (!profile || !profile.apiKey) {
            this.toast('Set an API key in your writing profile! ⚙️');
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
            const sectionCount = this.data.novelSections.length;
            userMsg = sceneInput
                ? `Continue the novel. Direction: ${sceneInput}\n\nDo NOT repeat any previous scenes. Introduce new events and conversations.`
                : `Continue the novel from where we left off. This is section ${sectionCount + 1}.\n\nIMPORTANT: Write a COMPLETELY NEW scene that has NOT appeared before. Advance the plot. Introduce a new event, a new conversation topic, or a new character interaction. DO NOT reuse any dialogue or scene structure from previous sections. Show something the reader hasn't seen yet.`;
        }

        const messages = this.buildMessages(userMsg);
        this.generating = true;
        this.setGenStatus(true, 'Writing...');
        this.disableControls(true);

        try {
            const response = await this.callAPIWithProfile(messages, profile);

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

                // Auto-summarize using SUMMARY profile (cheaper model)
                const summaryProfile = this.getSummaryProfile();
                if (summaryProfile && summaryProfile.apiKey) {
                    this.setGenStatus(true, 'Summarizing...');
                    await this.autoSummarize(response, summaryProfile);
                }

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

    async callAPIWithProfile(messages, profile) {
        const provider = profile.provider;
        let targetUrl;

        if (provider === 'nvidia') {
            targetUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
        } else if (provider === 'custom') {
            targetUrl = profile.baseUrl;
            if (!targetUrl) throw new Error('Set Base URL in your profile!');
            if (!targetUrl.includes('/chat/completions')) {
                targetUrl = targetUrl.replace(/\/$/, '') + '/chat/completions';
            }
        } else {
            targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
        }

        const bodyObj = {
            model: profile.model,
            messages: messages,
            max_tokens: this.data.maxTokens,
            temperature: this.data.temperature,
        };
        if (provider === 'nvidia') {
            bodyObj.chat_template_kwargs = { enable_thinking: true, thinking: true };
        }

        let fetchUrl, headers;

        if (provider === 'openrouter') {
            fetchUrl = targetUrl;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${profile.apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'NovelForge',
            };
        } else {
            // Route through CORS proxy
            fetchUrl = profile.proxyUrl;
            if (!fetchUrl) throw new Error('Set CORS Proxy URL in your profile for non-OpenRouter providers!');
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${profile.apiKey}`,
            };
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

        // Proxied calls return SSE stream; OpenRouter returns JSON
        if (provider !== 'openrouter') {
            return await this.readSSEStream(res);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    /* ---------- SSE STREAM PARSER ---------- */
    async readSSEStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep the last potentially incomplete line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) fullText += content;
                } catch { /* skip malformed chunks */ }
            }
        }

        if (!fullText) throw new Error('No content received from API stream');
        return fullText;
    }

    /* ---------- AUTO-SAVE ---------- */
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
    async autoSummarize(newText, summaryProfile) {
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

            const summary = await this.callAPIWithProfile(summaryPrompt, summaryProfile);
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
            output.innerHTML = `
                <div class="novel-empty">
                    <div class="empty-icon">📖</div>
                    <h3>Your Novel Starts Here</h3>
                    <p>Set up your world in the 🌍 World tab, then come back and start writing!</p>
                </div>`;
            return;
        }

        output.innerHTML = this.data.novelSections.map((s, i) => {
            const date = new Date(s.timestamp).toLocaleDateString();
            const parsedText = this.parseMd(s.text);
            return `
                <div class="novel-section">
                    <div class="section-meta">Section ${i + 1} · ${date}</div>
                    ${s.direction ? `<div class="section-direction">🎬 ${s.direction}</div>` : ''}
                    ${parsedText}
                </div>`;
        }).join('');

        output.scrollTop = output.scrollHeight;
    }

    parseMd(text) {
        return text
            .split('\n\n')
            .map(para => {
                let p = para.trim();
                if (!p) return '';
                if (p.startsWith('---')) return '<hr>';
                // Bold & italic
                p = p.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
                p = p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                p = p.replace(/\*(.*?)\*/g, '<em>$1</em>');
                return `<p>${p}</p>`;
            })
            .join('');
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
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('visible'), 10);
        setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 2500);
    }

    undoLast() {
        if (this.data.novelSections.length === 0) return;
        this.data.novelSections.pop();
        this.save();
        this.renderNovel();
        this.updateStats();
        this.toast('Last section removed');
    }

    /* ---------- STATS ---------- */
    updateStats() {
        const totalWords = this.data.novelSections.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
        document.getElementById('statNovelWords').textContent = totalWords.toLocaleString() + ' words';
        document.getElementById('statChapters').textContent = this.data.novelSections.length;

        const contextSize = (this.data.characters + this.data.worldSetting + this.data.writingStyle + this.data.rollingSummary).length;
        document.getElementById('statContext').textContent = `~${Math.round(contextSize / 4).toLocaleString()} tokens`;
    }

    previewContext() {
        const preview = document.getElementById('contextPreview');
        preview.classList.toggle('hidden');
        if (!preview.classList.contains('hidden')) {
            const msgs = this.buildMessages('[Your next prompt here]');
            preview.textContent = msgs.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
        }
    }

    /* ---------- EXPORT / IMPORT ---------- */
    exportNovel() {
        const text = this.data.novelSections.map((s, i) => {
            let block = `=== Section ${i + 1} ===\n`;
            if (s.direction) block += `Direction: ${s.direction}\n`;
            block += `\n${s.text}\n`;
            return block;
        }).join('\n\n');
        this.downloadFile('novelforge_novel.txt', text, 'text/plain');
    }

    exportAll() {
        this.downloadFile('novelforge_backup.json', JSON.stringify(this.data, null, 2), 'application/json');
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
            } catch { this.toast('Invalid JSON file'); }
        };
        reader.readAsText(file);
    }

    downloadFile(name, content, type) {
        const blob = new Blob([content], { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /* ---------- CLEAR ---------- */
    clearNovel() {
        if (!this._clearNovelConfirm) {
            this._clearNovelConfirm = true;
            this.toast('Tap again to confirm clear');
            setTimeout(() => this._clearNovelConfirm = false, 3000);
            return;
        }
        this.data.novelSections = [];
        this.data.rollingSummary = '';
        document.getElementById('rollingSummary').value = '';
        this.save();
        this.renderNovel();
        this.updateStats();
        this.toast('Novel cleared');
        this._clearNovelConfirm = false;
    }

    clearAll() {
        if (!this._clearAllConfirm) {
            this._clearAllConfirm = true;
            this.toast('Tap again to confirm FULL reset');
            setTimeout(() => this._clearAllConfirm = false, 3000);
            return;
        }
        this.data = this.defaults();
        this.save();
        this.init();
        this.toast('Everything reset');
        this._clearAllConfirm = false;
    }
}

// Boot
const app = new NovelApp();
