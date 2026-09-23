const phaseConfig = {
      sequence: {
        id: 'sequence',
        phaseNumber: 1,
        title: "Phase 1: Experience the Sequence",
        defaultPublished: true,
      },
      challenge: {
        id: 'challenge',
        phaseNumber: 2,
        title: "Phase 2: The Challenge (Colour Theory)",
        defaultPublished: false,
      },
      studio: {
        id: 'studio',
        phaseNumber: 3,
        title: "Phase 3: AI Prompt Tool (Build Simulation)",
        defaultPublished: false,
      },
      showcase: {
        id: 'showcase',
        phaseNumber: 4,
        title: "Phase 4: Showcase & Embed Simulation",
        defaultPublished: false,
      }
    };

    /* State Initialization */
    /* Facilitator Mode + phase-publish state now lives on a Cloudflare Worker
       (see handoff.md), not localStorage, so every participant sees the same
       published phases. The passcode is never stored client-side: it is only
       held in memory for the current tab, after the Worker confirms it. */
    const API_BASE_URL = 'https://creating-bespoke-learning-activities.duy-doan6.workers.dev';
    const STATE_POLL_INTERVAL_MS = 8000;

    let isFacilitatorMode = false;
    let facilitatorPasscode = null; // in-memory only, cleared on exit/reload
    let publishedPhases = {
      sequence: true,
      challenge: false,
      studio: false,
      showcase: false
    };
    let currentActiveTab = 'home';
    let attemptedLockedTab = null;
    let statePollingInterval = null;

    async function fetchPublishedState() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/state`);
        if (!res.ok) throw new Error('Bad response fetching state');
        const data = await res.json();
        if (data && typeof data === 'object') {
          const { sequence, challenge, studio, showcase } = data;
          publishedPhases = { sequence: !!sequence, challenge: !!challenge, studio: !!studio, showcase: !!showcase };
          updateFacilitatorModeUI();
          updatePhaseBadgesUI();
          if (currentActiveTab === 'locked' && attemptedLockedTab && publishedPhases[attemptedLockedTab]) {
            navigateTo(attemptedLockedTab);
          } else if (currentActiveTab !== 'home' && currentActiveTab !== 'locked' && !publishedPhases[currentActiveTab] && !isFacilitatorMode) {
            navigateToLatestUnlocked();
          }
        }
      } catch (e) {
        console.error('Could not sync phase state from server:', e);
      }
    }

    function startStatePolling() {
      if (statePollingInterval) return;
      statePollingInterval = setInterval(fetchPublishedState, STATE_POLL_INTERVAL_MS);
    }

    async function pushPublishedState() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: facilitatorPasscode, ...publishedPhases })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update state on server');
        }
      } catch (e) {
        console.error('Could not push phase state to server:', e);
        showToast('Could not sync that change to the server. Check your connection and try again.');
      }
    }

    /* Wishlist Discussion Posts */
    let wishlistPosts = [];
    let rewrittenWishlist = {};

    try {
      const savedWishlist = localStorage.getItem('rmit_phase1_wishlist_feed_clean');
      if (savedWishlist) {
        wishlistPosts = JSON.parse(savedWishlist);
      }
      const savedRewrites = localStorage.getItem('rmit_phase1_rewritten_wishlist');
      if (savedRewrites) {
        rewrittenWishlist = JSON.parse(savedRewrites);
      }
    } catch(e) {}

    function saveWishlistPosts() {
      try {
        localStorage.setItem('rmit_phase1_wishlist_feed_clean', JSON.stringify(wishlistPosts));
      } catch(e) {}
    }

    function saveRewrittenWishlist() {
      try {
        localStorage.setItem('rmit_phase1_rewritten_wishlist', JSON.stringify(rewrittenWishlist));
      } catch(e) {}
    }

    /* Facilitator Mode Controller */
    function handleFacilitatorToggleClick() {
      if (isFacilitatorMode) {
        exitFacilitatorMode();
      } else {
        openPasswordModal();
      }
    }

    function openPasswordModal() {
      const modal = document.getElementById('facilitatorPasswordModal');
      const input = document.getElementById('facilitatorPasswordInput');
      const errorMsg = document.getElementById('passwordErrorMsg');
      if (errorMsg) errorMsg.classList.add('hidden');
      if (input) input.value = '';
      if (modal) modal.classList.remove('hidden');
      if (input) setTimeout(() => input.focus(), 50);
    }

    function closePasswordModal() {
      const modal = document.getElementById('facilitatorPasswordModal');
      if (modal) modal.classList.add('hidden');
    }

    async function handlePasswordSubmit(e) {
      if (e) e.preventDefault();
      const input = document.getElementById('facilitatorPasswordInput');
      const errorMsg = document.getElementById('passwordErrorMsg');
      const enteredPasscode = input ? input.value : '';

      try {
        const res = await fetch(`${API_BASE_URL}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: enteredPasscode })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.ok) {
          isFacilitatorMode = true;
          facilitatorPasscode = enteredPasscode;
          closePasswordModal();
          updateFacilitatorModeUI();
          showToast('Facilitator Mode unlocked successfully.');
        } else {
          if (errorMsg) {
            errorMsg.textContent = 'Incorrect passcode. Please try again.';
            errorMsg.classList.remove('hidden');
          }
          if (input) {
            input.focus();
            input.select();
          }
        }
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = 'Could not reach the server. Check your connection.';
          errorMsg.classList.remove('hidden');
        }
      }
    }

    function exitFacilitatorMode() {
      isFacilitatorMode = false;
      facilitatorPasscode = null;
      updateFacilitatorModeUI();
      showToast('Exited Facilitator Mode.');
      if (currentActiveTab === 'locked' && attemptedLockedTab && !publishedPhases[attemptedLockedTab]) {
        navigateToLatestUnlocked();
      }
    }

    async function togglePhasePublish(phaseKey) {
      if (!publishedPhases.hasOwnProperty(phaseKey)) return;
      publishedPhases[phaseKey] = !publishedPhases[phaseKey];
      updateFacilitatorModeUI();
      updatePhaseBadgesUI();

      const phaseName = phaseConfig[phaseKey] ? phaseConfig[phaseKey].title : phaseKey;
      if (publishedPhases[phaseKey]) {
        showToast(`${phaseName} is now PUBLISHED.`);
        if (currentActiveTab === 'locked' && attemptedLockedTab === phaseKey) {
          navigateTo(phaseKey);
        }
      } else {
        showToast(`${phaseName} is now LOCKED.`);
        if (currentActiveTab === phaseKey) {
          navigateToLatestUnlocked();
        }
      }

      await pushPublishedState();
    }

    function unlockNextPhase() {
      const order = ['sequence', 'challenge', 'studio', 'showcase'];
      const nextLocked = order.find(p => !publishedPhases[p]);
      if (nextLocked) {
        togglePhasePublish(nextLocked);
      } else {
        showToast('All phases are already published.');
      }
    }

    async function publishAllPhases(publishAll) {
      Object.keys(publishedPhases).forEach(k => {
        publishedPhases[k] = publishAll;
      });
      if (!publishAll) {
        publishedPhases.sequence = true;
      }
      updateFacilitatorModeUI();
      updatePhaseBadgesUI();
      showToast(publishAll ? 'All phases are now PUBLISHED.' : 'Reset to Phase 1 only.');

      if (!publishAll && currentActiveTab !== 'home' && currentActiveTab !== 'sequence') {
        navigateTo('sequence');
      }

      await pushPublishedState();
    }

    function publishCurrentLockedPhase() {
      if (attemptedLockedTab) {
        togglePhasePublish(attemptedLockedTab);
      }
    }

    function updateFacilitatorModeUI() {
      const panel = document.getElementById('facilitatorControlPanel');
      const dot = document.getElementById('facilitatorModeDot');
      const label = document.getElementById('facilitatorModeLabel');
      const toggleBtn = document.getElementById('btnFacilitatorModeToggle');
      const facilitatorLockedAction = document.getElementById('facilitatorLockedAction');
      const overviewStatus = document.getElementById('overviewFacilitatorStatus');

      if (isFacilitatorMode) {
        if (panel) panel.classList.remove('hidden');
        if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        if (label) label.textContent = "Facilitator Mode (Active)";
        if (toggleBtn) {
          toggleBtn.className = "px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100";
        }
        if (facilitatorLockedAction) facilitatorLockedAction.classList.remove('hidden');
        if (overviewStatus) {
          overviewStatus.innerHTML = '<span class="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Facilitator Mode Enabled</span>';
        }
      } else {
        if (panel) panel.classList.add('hidden');
        if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-400";
        if (label) label.textContent = "Facilitator Mode";
        if (toggleBtn) {
          toggleBtn.className = "px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100";
        }
        if (facilitatorLockedAction) facilitatorLockedAction.classList.add('hidden');
        if (overviewStatus) overviewStatus.innerHTML = '';
      }

      ['sequence', 'challenge', 'studio', 'showcase'].forEach(phaseKey => {
        const isPublished = !!publishedPhases[phaseKey];
        const card = document.getElementById(`panelCard${capitalize(phaseKey)}`);
        const statusEl = document.getElementById(`panelStatus${capitalize(phaseKey)}`);
        const btn = document.getElementById(`panelBtn${capitalize(phaseKey)}`);

        if (card && statusEl && btn) {
          if (isPublished) {
            card.className = "flex items-center justify-between p-2 px-3 rounded-lg border border-emerald-500/50 bg-emerald-950/40 gap-3";
            statusEl.className = "text-[10px] font-black uppercase tracking-wider text-emerald-400";
            statusEl.textContent = "PUBLISHED ✓";
            btn.className = "px-2.5 py-1 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition shadow-sm";
            btn.textContent = "Lock";
          } else {
            card.className = "flex items-center justify-between p-2 px-3 rounded-lg border border-slate-700 bg-slate-800/90 gap-3";
            statusEl.className = "text-[10px] font-black uppercase tracking-wider text-slate-400";
            statusEl.textContent = "LOCKED 🔒";
            btn.className = "px-3 py-1 rounded text-[11px] font-bold bg-[#E60028] hover:bg-[#b80020] text-white transition shadow-sm";
            btn.textContent = "Publish";
          }
        }
      });
    }

    function updatePhaseBadgesUI() {
      ['sequence', 'challenge', 'studio', 'showcase'].forEach(phaseKey => {
        const isPub = !!publishedPhases[phaseKey];
        const navBadge = document.getElementById(`navBadge${capitalize(phaseKey)}`);
        const cardBadge = document.getElementById(`cardBadge${capitalize(phaseKey)}`);
        const cardAction = document.getElementById(`cardAction${capitalize(phaseKey)}`);

        if (navBadge) {
          if (isPub) {
            navBadge.className = "text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800";
            navBadge.textContent = "Live";
          } else {
            navBadge.className = "text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-600";
            navBadge.textContent = "🔒";
          }
        }

        if (cardBadge) {
          if (isPub) {
            cardBadge.className = "text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800";
            cardBadge.textContent = "Published";
          } else {
            cardBadge.className = "text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500";
            cardBadge.textContent = "🔒 Locked";
          }
        }

        if (cardAction) {
          if (isPub) {
            cardAction.innerHTML = `Enter Phase ${phaseConfig[phaseKey].phaseNumber} &rarr;`;
          } else {
            cardAction.innerHTML = `<span class="text-slate-400">Locked — Waiting for release</span>`;
          }
        }
      });
    }

    function navigateTo(tabId) {
      if (tabId !== 'home' && !publishedPhases[tabId] && !isFacilitatorMode) {
        showLockedScreen(tabId);
        return;
      }

      attemptedLockedTab = null;
      currentActiveTab = tabId;

      const allTabs = ['home', 'sequence', 'challenge', 'studio', 'showcase', 'lockedPhase'];
      allTabs.forEach(id => {
        const el = document.getElementById(id === 'lockedPhase' ? 'tabLockedPhase' : `tab${capitalize(id)}`);
        if (el) el.classList.add('hidden');
      });

      const activeEl = document.getElementById(`tab${capitalize(tabId)}`);
      if (activeEl) activeEl.classList.remove('hidden');

      ['home', 'sequence', 'challenge', 'studio', 'showcase'].forEach(id => {
        const btn = document.getElementById(`tabBtn${capitalize(id)}`);
        if (btn) {
          if (id === tabId) {
            btn.className = "px-3 py-1.5 rounded-md font-bold text-white bg-[#000054] transition shadow-sm";
          } else {
            btn.className = "px-2.5 sm:px-3 py-1.5 rounded-md font-medium text-slate-700 hover:text-[#000054] hover:bg-slate-200 transition flex items-center gap-1.5";
          }
        }
      });

      if (tabId === 'studio') generateCleanPrompt();
      if (tabId === 'challenge') {
        renderStickyNotes();
      }
      if (tabId === 'showcase') compileCompleteSequence();

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showLockedScreen(targetPhaseKey) {
      attemptedLockedTab = targetPhaseKey;
      currentActiveTab = 'locked';

      const allTabs = ['home', 'sequence', 'challenge', 'studio', 'showcase'];
      allTabs.forEach(id => {
        const el = document.getElementById(`tab${capitalize(id)}`);
        if (el) el.classList.add('hidden');
      });

      const lockedScreen = document.getElementById('tabLockedPhase');
      if (lockedScreen) lockedScreen.classList.remove('hidden');

      const titleEl = document.getElementById('lockedPhaseTitle');
      const pillEl = document.getElementById('lockedPhasePill');
      const meta = phaseConfig[targetPhaseKey];

      if (titleEl && meta) {
        titleEl.textContent = meta.title;
      }
      if (pillEl && meta) {
        pillEl.textContent = `Phase ${meta.phaseNumber} Currently Locked`;
      }

      const actionBox = document.getElementById('facilitatorLockedAction');
      if (actionBox) {
        if (isFacilitatorMode) {
          actionBox.classList.remove('hidden');
        } else {
          actionBox.classList.add('hidden');
        }
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigateToLatestUnlocked() {
      const order = ['showcase', 'studio', 'challenge', 'sequence'];
      const latest = order.find(p => publishedPhases[p]) || 'sequence';
      navigateTo(latest);
    }

    function capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /* Sticky Notes State & Management for Phase 2 */
    let stickyNotes = [
      {
        id: 1,
        author: "Group 1",
        text: "Students calibrate button text contrast to WCAG AA (4.5:1) before committing their digital app palette."
      },
      {
        id: 2,
        author: "Group 3",
        text: "Students test outdoor sunlight glare with a slider tool and replace low-contrast light grey text."
      }
    ];

    try {
      const savedStickies = localStorage.getItem('rmit_challenge_stickies_v3');
      if (savedStickies) stickyNotes = JSON.parse(savedStickies);
    } catch(e) {}

    function saveStickyNotes() {
      try {
        localStorage.setItem('rmit_challenge_stickies_v3', JSON.stringify(stickyNotes));
      } catch(e) {}
    }

    function addStickyNote() {
      const text = document.getElementById('stickyText').value.trim();
      const author = document.getElementById('stickyAuthor').value.trim() || 'Our Group';

      if (!text) {
        showToast('Please type an outcome or idea for your note.');
        return;
      }

      const newNote = {
        id: Date.now(),
        author,
        text
      };

      stickyNotes.unshift(newNote);
      saveStickyNotes();
      renderStickyNotes();

      document.getElementById('stickyText').value = '';
      showToast('Note added to the board!');
    }

    function deleteStickyNote(id) {
      stickyNotes = stickyNotes.filter(n => n.id !== id);
      saveStickyNotes();
      renderStickyNotes();
      showToast('Note removed.');
    }

    function renderStickyNotes() {
      const container = document.getElementById('stickyNotesGrid');
      if (!container) return;

      if (stickyNotes.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-6 text-center text-slate-400 text-xs sm:text-sm border-2 border-dashed border-slate-200 rounded-xl">
            No sticky notes posted yet. Add your group's measurable outcome above!
          </div>
        `;
        return;
      }

      container.innerHTML = stickyNotes.map(n => `
        <div class="p-4 rounded-xl border border-amber-200 bg-amber-50/90 text-amber-950 flex flex-col justify-between space-y-2.5 shadow-sm transition hover:-translate-y-0.5">
          <div class="flex items-center justify-between text-[11px] font-bold border-b border-amber-200 pb-1 text-[#000054]">
            <span class="uppercase tracking-wider">${escapeHtml(n.author)}</span>
            <button onclick="deleteStickyNote(${n.id})" class="text-slate-400 hover:text-red-700 font-bold text-xs" title="Delete note">✕</button>
          </div>
          <p class="text-xs sm:text-sm leading-relaxed text-slate-800 flex-1">${escapeHtml(n.text)}</p>
          <div class="pt-1 border-t border-amber-200 flex justify-end">
            <button onclick="sendStickyToPrompt(${n.id})" class="text-xs font-bold text-[#000054] underline hover:opacity-80 flex items-center gap-1">
              <span>Send to Prompt</span> <span>&rarr;</span>
            </button>
          </div>
        </div>
      `).join('');
    }

    /* Sequence & Simulation Compiler Logic */
    function handleDragOver(e) {
      e.preventDefault();
      const dropzone = document.getElementById('simDropzone');
      if (dropzone) dropzone.classList.add('border-[#000054]', 'bg-blue-50');
    }

    function handleDragLeave(e) {
      e.preventDefault();
      const dropzone = document.getElementById('simDropzone');
      if (dropzone) dropzone.classList.remove('border-[#000054]', 'bg-blue-50');
    }

    function handleFileDrop(e) {
      e.preventDefault();
      const dropzone = document.getElementById('simDropzone');
      if (dropzone) dropzone.classList.remove('border-[#000054]', 'bg-blue-50');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedFile(e.dataTransfer.files[0]);
      }
    }

    function handleFileSelect(e) {
      if (e.target.files && e.target.files[0]) {
        processUploadedFile(e.target.files[0]);
      }
    }

    function processUploadedFile(file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('embedSimCode').value = event.target.result;
        document.getElementById('dropzoneLabel').textContent = `✓ Loaded: ${file.name}`;
        document.getElementById('dropzoneSubLabel').textContent = `${(file.size / 1024).toFixed(1)} KB - Ready to compile`;
        compileCompleteSequence();
        showToast(`Loaded ${file.name} successfully!`);
      };
      reader.readAsText(file);
    }

    function generateCompiledDocument() {
      let rawSimCode = document.getElementById('embedSimCode') ? document.getElementById('embedSimCode').value.trim() : '';
      if (!rawSimCode) {
        rawSimCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    html, body { background-color: #ffffff !important; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; }
  </style>
</head>
<body class="bg-white" style="background-color: #ffffff !important;">
  <div style="background-color: #ffffff !important;" class="max-w-xl mx-auto p-8 rounded-xl border-2 border-dashed border-[#000054] text-center space-y-3">
    <div class="inline-block p-3 rounded-full bg-blue-50 text-[#000054] mb-1">
      <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
    </div>
    <h3 class="font-bold text-[#000054] text-lg">Interactive Simulation Trigger</h3>
    <p class="text-slate-600 text-sm">Your bespoke AI-generated simulation will run interactively inside this container.</p>
    <button class="px-5 py-2.5 bg-[#000054] text-white rounded-lg font-bold text-sm hover:bg-[#00003c] transition shadow">Test Contrast Under Sunlight</button>
  </div>
</body>
</html>`;
      }

      const whiteBgOverride = `<style>html, body { background-color: #ffffff !important; background: #ffffff !important; }</style>`;
      let sanitizedSimCode = rawSimCode;
      if (sanitizedSimCode.toLowerCase().includes('</head>')) {
        sanitizedSimCode = sanitizedSimCode.replace(/<\/head>/i, `${whiteBgOverride}</head>`);
      } else if (sanitizedSimCode.toLowerCase().includes('<body')) {
        sanitizedSimCode = whiteBgOverride + sanitizedSimCode;
      }

      const escapedSrcdoc = sanitizedSimCode.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const placementPos = document.getElementById('embedPlacementPosition') ? document.getElementById('embedPlacementPosition').value : 'section3';

      const simContainerHtml = `
        <div class="my-6 rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden">
          <div class="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-[#000054] flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#E60028]"></span>
              <span>Active Learning Trigger (Interactive Simulation)</span>
            </span>
            <span class="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded">Isolated Sandbox</span>
          </div>
          <div class="p-2 sm:p-4 bg-white">
            <iframe 
              srcdoc="${escapedSrcdoc}"
              class="w-full min-h-[580px] border-0 rounded-lg bg-white block" 
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="Embedded Learning Simulation"
            ></iframe>
          </div>
        </div>
      `;

      const sec1Html = `
        <div class="space-y-2">
          <h3 class="text-lg font-bold text-[#000054]">1. Why contrast matters</h3>
          <p class="text-slate-700 leading-relaxed">
            Have you ever struggled to read an app outside in bright sunlight? That's a contrast problem, and it affects almost everyone at some point, not just people with visual impairments.
          </p>
          <p class="text-slate-700 leading-relaxed">
            Contrast is simply how different two colours look next to each other. Dark text on a white background has high contrast. Light grey text on white has low contrast. The higher the contrast, the easier something is to read.
          </p>
        </div>
      `;

      const sec2Html = `
        <div class="space-y-2">
          <h3 class="text-lg font-bold text-[#000054]">2. Why it's a bigger deal than it sounds</h3>
          <p class="text-slate-700 leading-relaxed">
            When designing with colour, it's easy to focus on mood and vibe and forget function. Picture reading your phone in bright sunlight, using an app late at night with tired eyes, or being colourblind and unable to tell a red warning from a green confirmation. Good contrast solves all of these at once.
          </p>
        </div>
      `;

      const sec3Html = `
        <div class="space-y-2">
          <h3 class="text-lg font-bold text-[#000054]">3. Fix the palette</h3>
          <p class="text-slate-700 leading-relaxed">
            Imagine you've been given a mobile app screen from a campus events app. Header, buttons, and body text all fail WCAG contrast standards. Test each pair and adjust colours until they pass readable standards.
          </p>
        </div>
      `;

      const sec4Html = `
        <div class="space-y-3 pt-2">
          <h3 class="text-lg font-bold text-[#000054]">4. Check your understanding of colour contrast</h3>
          <p class="text-slate-700 text-sm leading-relaxed">Inspect whether each pair meets readable standards (≥ 4.5:1):</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-3 bg-white border border-slate-300 rounded-xl space-y-2 shadow-sm">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Option A</span>
              <div class="p-3 border-2 border-black rounded-xl text-center text-xs font-bold" style="background:#FFFFFF;color:#000000;box-shadow: 0 4px 0 #000;">
                Numbers Button
              </div>
              <span class="text-[11px] text-slate-600 block">Black on White (#000000 on #FFFFFF)</span>
            </div>
            <div class="p-3 bg-white border border-slate-300 rounded-xl space-y-2 shadow-sm">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Option B</span>
              <div class="p-3 border-2 border-black rounded-xl text-center text-xs font-bold" style="background:#FFFFFF;color:#A0C4FF;box-shadow: 0 4px 0 #000;">
                Font Button
              </div>
              <span class="text-[11px] text-slate-600 block">Light Blue on White (#A0C4FF on #FFFFFF)</span>
            </div>
            <div class="p-3 bg-white border border-slate-300 rounded-xl space-y-2 shadow-sm">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Option C</span>
              <div class="p-3 border-2 border-black rounded-xl text-center text-xs font-bold" style="background:#1A1A2E;color:#FFFFFF;box-shadow: 0 4px 0 #000;">
                Typography
              </div>
              <span class="text-[11px] text-slate-600 block">White on Navy (#FFFFFF on #1A1A2E)</span>
            </div>
          </div>
          <div class="pt-2">
            <p class="text-slate-800 text-sm font-semibold leading-relaxed">
              Good job! Hopefully you can take away at least one practice you'll carry into your own app design assessment.
            </p>
          </div>
        </div>
      `;

      let assembledBody = '';
      if (placementPos === 'section1') {
        assembledBody = sec1Html + simContainerHtml + sec2Html + sec3Html + sec4Html;
      } else if (placementPos === 'section2') {
        assembledBody = sec1Html + sec2Html + simContainerHtml + sec3Html + sec4Html;
      } else if (placementPos === 'section4') {
        assembledBody = sec1Html + sec2Html + sec3Html + simContainerHtml + sec4Html;
      } else {
        assembledBody = sec1Html + sec2Html + sec3Html + simContainerHtml + sec4Html;
      }

      return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compiled Sequence Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    html, body { background-color: #ffffff !important; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 24px; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body style="background-color: #ffffff !important;">
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="bg-gradient-to-r from-[#000054] to-[#0a1240] p-6 rounded-xl text-white mb-6 border-b-4 border-[#FAC800] shadow-sm flex items-center justify-between">
      <div>
        <span class="bg-[#FAC800] text-[#000054] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Active Course Sequence</span>
        <h2 class="text-xl font-bold mt-1 text-white">Colour Theory in Digital Design</h2>
      </div>
      <span class="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-400/40 px-2.5 py-1 rounded font-medium">✓ Embedded Simulation</span>
    </div>

    ${assembledBody}
  </div>
</body>
</html>`;
    }

    function compileCompleteSequence() {
      const iframe = document.getElementById('compiledPreviewFrame');
      if (iframe) {
        iframe.srcdoc = generateCompiledDocument();
      }
    }

    function openPreviewInNewTab() {
      const compiledDoc = generateCompiledDocument();
      const blob = new Blob([compiledDoc], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const newWin = window.open(blobUrl, '_blank');
      if (!newWin) {
        showToast('Please allow popups to open the preview in a new tab.');
      } else {
        showToast('Opened assembled sequence in a new tab!');
      }
    }

    /* Requirements Table Event Handlers */
    function handleReqChange(selectEl) {
      const selectedValue = selectEl.value;
      const correctAnswer = selectEl.getAttribute('data-correct');
      const row = selectEl.closest('tr');
      const container = selectEl.closest('.dropdown-container');
      const icon = container ? container.querySelector('.feedback-icon') : null;
      const feedbackCell = row.querySelector('.feedback-cell');
      const feedbackMsg = feedbackCell ? feedbackCell.getAttribute('data-feedback') : '';

      row.classList.remove('req-row-correct', 'req-row-incorrect');
      if (icon) icon.textContent = '';
      if (feedbackCell) feedbackCell.textContent = '';

      if (selectedValue !== 'Select') {
        if (selectedValue === correctAnswer) {
          row.classList.add('req-row-correct');
          if (icon) icon.textContent = '✔';
          if (feedbackCell) feedbackCell.textContent = feedbackMsg;
        } else {
          row.classList.add('req-row-incorrect');
          if (icon) icon.textContent = '✖';
          if (feedbackCell) feedbackCell.textContent = 'Incorrect. Try again!';
        }
      }
    }

    function saveReqAnswers() {
      document.querySelectorAll('.req-table select').forEach(sel => {
        localStorage.setItem('rmit_canvas_req_' + sel.id, sel.value);
      });
      showToast('Your answers have been saved locally.');
    }

    function resetReqAnswers() {
      document.querySelectorAll('.req-table select').forEach(sel => {
        localStorage.removeItem('rmit_canvas_req_' + sel.id);
        sel.value = 'Select';
        handleReqChange(sel);
      });
      showToast('Table reset. Ready to try again.');
    }

    /* Toast Notification System */
    function showToast(msg) {
      const container = document.getElementById('toastBox');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = "bg-[#000054] text-white text-xs sm:text-sm px-4 py-3 rounded-lg shadow-lg border-l-4 border-l-[#E60028] pointer-events-auto transition-all duration-200 transform translate-y-2 opacity-0";
      toast.textContent = msg;

      container.appendChild(toast);
      requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      });

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-1');
        setTimeout(() => {
          if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 200);
      }, 3000);
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function addWishlistDiscussionPost() {
      const author = document.getElementById('wishlistAuthorInput').value.trim() || 'Anonymous';
      const text = document.getElementById('wishlistTextInput').value.trim();

      if (!text) {
        showToast('Please type a wishlist note before posting.');
        return;
      }

      const newPost = {
        id: Date.now(),
        author,
        text,
        time: "Just now"
      };

      wishlistPosts.unshift(newPost);
      saveWishlistPosts();
      renderWishlistDiscussionFeed();
      renderRewriteWishlistActivity();

      document.getElementById('wishlistTextInput').value = '';
      showToast('Wishlist note posted to the board!');
    }

    function deleteWishlistPost(id) {
      wishlistPosts = wishlistPosts.filter(p => p.id !== id);
      delete rewrittenWishlist[id];
      saveWishlistPosts();
      saveRewrittenWishlist();
      renderWishlistDiscussionFeed();
      renderRewriteWishlistActivity();
      showToast('Note removed.');
    }

    function renderWishlistDiscussionFeed() {
      const container = document.getElementById('wishlistDiscussionFeed');
      const countEl = document.getElementById('wishlistPostCount');
      if (!container) return;

      if (countEl) countEl.textContent = `${wishlistPosts.length} notes`;

      if (wishlistPosts.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No wishlist notes posted yet. Post your first informal wish above!
          </div>
        `;
        return;
      }

      container.innerHTML = wishlistPosts.map(p => `
        <div class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 flex items-start justify-between gap-3 transition">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[#000054]">${escapeHtml(p.author)}</span>
              <span class="text-[11px] text-slate-400">${escapeHtml(p.time || 'Shared')}</span>
            </div>
            <p class="text-sm text-slate-800 leading-relaxed font-medium">"${escapeHtml(p.text)}"</p>
          </div>
          <button onclick="deleteWishlistPost(${p.id})" class="text-slate-400 hover:text-rose-600 text-xs font-bold p-1" title="Remove note">✕</button>
        </div>
      `).join('');
    }

    /* Revisiting Your Wishlist Activity */
    function renderRewriteWishlistActivity() {
      const container = document.getElementById('rewriteWishlistContainer');
      if (!container) return;

      if (wishlistPosts.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center text-slate-500 text-sm bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-1">
            <span class="font-bold text-slate-700 block">No wishlist items posted yet</span>
            <p class="text-xs text-slate-500">Post a wishlist note above in the discussion box, and it will appear here ready to be rewritten into a measurable requirement!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = wishlistPosts.map(p => {
        const savedText = rewrittenWishlist[p.id] || '';
        return `
          <div class="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-[#000054] bg-blue-100 px-2 py-0.5 rounded">
                Original Wish (${escapeHtml(p.author)})
              </span>
              <button 
                type="button" 
                onclick="toggleWishlistHint(${p.id})"
                class="text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-100 px-2.5 py-1 rounded transition flex items-center gap-1"
              >
                <span>💡 Need a Hint?</span>
              </button>
            </div>

            <div class="p-3 bg-white rounded-lg border border-slate-200">
              <p class="text-sm font-semibold text-slate-800 italic">"${escapeHtml(p.text)}"</p>
            </div>

            <div id="hintBox_${p.id}" class="hidden p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <strong class="font-bold text-amber-900 block">Improvement Checklist:</strong>
              <ul class="list-disc pl-4 space-y-0.5">
                <li><strong>Make it Specific:</strong> Name the exact action or component (e.g. "The system shall...").</li>
                <li><strong>Make it Measurable:</strong> Add numbers, time limits (e.g. "within 5 seconds"), or accepted formats.</li>
                <li><strong>Make it Verifiable:</strong> How can an engineer test it with pass/fail criteria?</li>
              </ul>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                Rewrite into a Specific, Measurable, and Verifiable Requirement:
              </label>
              <textarea 
                rows="2"
                id="rewriteInput_${p.id}"
                class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white text-slate-900 focus:border-[#000054] focus:ring-1 focus:ring-[#000054]"
                placeholder="e.g. The system shall dispense the selected beverage within 5 seconds of card payment confirmation..."
                oninput="handleWishlistRewriteInput(${p.id}, this.value)"
              >${escapeHtml(savedText)}</textarea>
            </div>

            <div class="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span id="savedIndicator_${p.id}" class="text-emerald-700 font-semibold ${savedText ? '' : 'hidden'}">✓ Auto-saved</span>
              <span class="text-slate-400">Must detail exact behavior, metrics, and test method</span>
            </div>
          </div>
        `;
      }).join('');
    }

    function toggleWishlistHint(id) {
      const box = document.getElementById(`hintBox_${id}`);
      if (box) box.classList.toggle('hidden');
    }

    function handleWishlistRewriteInput(id, val) {
      rewrittenWishlist[id] = val;
      saveRewrittenWishlist();
      const ind = document.getElementById(`savedIndicator_${id}`);
      if (ind) ind.classList.remove('hidden');
    }

    /* Prompt Generation: Strictly the 6 Core Fields */
    function generateCleanPrompt() {
      const role = document.getElementById('promptRole').value.trim() || "Act as a Learning Designer and Educational Technologist.";
      const request = document.getElementById('promptRequest').value.trim() || "Build a self-contained HTML simulation with a clean, neat, and intuitive mechanic (not overly complex or overwhelming) that lets students test a mobile app colour palette under a simulated bright-sunlight filter.";
      const goal = document.getElementById('promptGoal').value.trim() || "Students should be able to: identify the impact of different light sources on screen readability, and adjust text contrast to meet readable standards.";
      const audience = document.getElementById('promptAudience').value.trim() || "Audience: 2nd-year Graphic Design / UX students.";
      const context = document.getElementById('promptContext').value.trim() || "Context: this is an active exercise to introduce colour contrast and accessibility; students have a basic understanding of colour theory but tend to overlook real-world ambient glare.";
      const outputSpec = document.getElementById('promptOutputSpec').value.trim() || "Output: one runnable HTML file, clean and neat mechanics (not overly complex or overwhelming), light-mode with strict white background (#ffffff), works on desktop and laptop browsers.";

      const prompt = `ROLE
${role}

REQUEST
${request}

GOAL
${goal}

AUDIENCE
${audience}

CONTEXT
${context}

OUTPUT SPEC
${outputSpec}`;

      document.getElementById('cleanPromptOutput').textContent = prompt;
    }

    function copyPromptText() {
      const text = document.getElementById('cleanPromptOutput').textContent;
      const temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        showToast('Prompt copied to clipboard! Paste it into Gemini Canvas.');
      } catch (err) {
        showToast('Please select and copy the text manually.');
      }
      document.body.removeChild(temp);
    }

    function sendStickyToPrompt(id) {
      const note = stickyNotes.find(n => n.id === id);
      if (!note) return;

      document.getElementById('promptGoal').value = `Students should be able to: ${note.text}`;
      navigateTo('studio');
      generateCleanPrompt();
      showToast('Transferred note to AI Prompt Tool!');
    }

    function transferActiveNotesToStudio() {
      const noteText = stickyNotes.length > 0 
        ? stickyNotes[0].text 
        : "Students test and adjust text colours to achieve a clear, readable contrast ratio (WCAG 4.5:1) before finalising their app.";

      document.getElementById('promptGoal').value = `Students should be able to: ${noteText}`;
      navigateTo('studio');
      generateCleanPrompt();
      showToast('Transferred group ideas to AI Prompt Tool!');
    }

    // Initialize State on Page Load
    window.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.req-table select').forEach(sel => {
        const saved = localStorage.getItem('rmit_canvas_req_' + sel.id);
        if (saved) {
          sel.value = saved;
          handleReqChange(sel);
        }
      });
      updateFacilitatorModeUI();
      updatePhaseBadgesUI();
      generateCleanPrompt();
      renderStickyNotes();
      renderWishlistDiscussionFeed();
      renderRewriteWishlistActivity();
      compileCompleteSequence();

      // Pull the shared phase-publish state from the Cloudflare Worker, then
      // keep polling so every participant's tab stays in sync.
      fetchPublishedState();
      startStatePolling();
    });
