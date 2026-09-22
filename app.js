/* Phase Metadata Definitions */
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
        title: "Phase 2: The Challenge (Review Drafts)",
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

    /* ===================================================================
       SHARED STATE (Cloudflare Worker + KV)
       All participants read the same published-phase state from this API.
       Facilitator actions write to it (passcode checked server-side).
       Fill in your deployed Worker URL below after `wrangler deploy`.
       =================================================================== */
    const API_BASE_URL = 'https://REPLACE-WITH-YOUR-WORKER.workers.dev'; // <-- PUT YOUR WORKER URL HERE
    const STATE_POLL_INTERVAL_MS = 8000; // how often audience devices re-check the live state

    /* State Initialization */
    let isFacilitatorMode = false;
    let facilitatorPasscode = null; // kept in memory only for this tab/session, never persisted
    let publishedPhases = {
      sequence: true,
      challenge: false,
      studio: false,
      showcase: false
    };
    let currentActiveTab = 'home';
    let attemptedLockedTab = null;
    let statePollTimer = null;

    // Facilitator Mode itself (not the publish state) is still remembered per-browser,
    // purely as a UI convenience so the facilitator doesn't have to keep re-entering the
    // passcode on every reload of their own device. It does NOT grant access by itself -
    // every write still needs the passcode, verified by the Worker.
    try {
      const savedFacilitator = sessionStorage.getItem('rmit_facilitator_mode');
      const savedPasscode = sessionStorage.getItem('rmit_facilitator_passcode');
      if (savedFacilitator === 'true' && savedPasscode) {
        isFacilitatorMode = true;
        facilitatorPasscode = savedPasscode;
      }
    } catch(e) {}

    function saveFacilitatorSession() {
      try {
        sessionStorage.setItem('rmit_facilitator_mode', isFacilitatorMode);
        if (facilitatorPasscode) {
          sessionStorage.setItem('rmit_facilitator_passcode', facilitatorPasscode);
        } else {
          sessionStorage.removeItem('rmit_facilitator_passcode');
        }
      } catch(e) {}
    }

    /* Fetch the live shared state from the Worker and refresh the UI */
    async function fetchSharedState({ silent } = {}) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/state`, { cache: 'no-store' });
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        publishedPhases = {
          sequence: !!data.sequence,
          challenge: !!data.challenge,
          studio: !!data.studio,
          showcase: !!data.showcase,
        };
        updatePhaseBadgesUI();

        // If audience is stuck on a locked screen and it just got published, jump in
        if (currentActiveTab === 'lockedPhase' && attemptedLockedTab && publishedPhases[attemptedLockedTab]) {
          actualSwitchTab(attemptedLockedTab);
        }
      } catch (err) {
        if (!silent) showToast('Không thể kết nối máy chủ trạng thái — đang dùng dữ liệu gần nhất.');
      }
    }

    /* Push a new publish state to the Worker (facilitator only, passcode required) */
    async function pushSharedState(nextPublishedPhases) {
      if (!facilitatorPasscode) {
        showToast('Bạn cần bật Facilitator Mode trước.');
        return false;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: facilitatorPasscode, publishedPhases: nextPublishedPhases }),
        });
        if (res.status === 401) {
          showToast('Mật khẩu Facilitator không đúng hoặc đã hết hạn — vui lòng đăng nhập lại.');
          exitFacilitatorMode();
          return false;
        }
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        publishedPhases = {
          sequence: !!data.sequence,
          challenge: !!data.challenge,
          studio: !!data.studio,
          showcase: !!data.showcase,
        };
        updatePhaseBadgesUI();
        return true;
      } catch (err) {
        showToast('Lỗi kết nối — thay đổi chưa được lưu, thử lại nhé.');
        return false;
      }
    }

    function startStatePolling() {
      if (statePollTimer) clearInterval(statePollTimer);
      statePollTimer = setInterval(() => fetchSharedState({ silent: true }), STATE_POLL_INTERVAL_MS);
    }

    /* Facilitator Mode Passcode Modal Controls */
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
      const err = document.getElementById('passwordErrorMsg');
      
      err.classList.add('hidden');
      input.value = '';
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 50);
    }

    function closePasswordModal() {
      document.getElementById('facilitatorPasswordModal').classList.add('hidden');
    }

    async function handlePasswordSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('facilitatorPasswordInput');
      const err = document.getElementById('passwordErrorMsg');
      const submitBtn = document.getElementById('btnFacilitatorPasswordSubmit');
      const candidate = input.value.trim();

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking...'; }

      try {
        const res = await fetch(`${API_BASE_URL}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: candidate }),
        });

        if (res.ok) {
          isFacilitatorMode = true;
          facilitatorPasscode = candidate;
          saveFacilitatorSession();
          closePasswordModal();
          updateFacilitatorModeUI();
          await fetchSharedState();
          showToast('Facilitator Mode unlocked! Phase release controls are active.');
        } else {
          err.textContent = 'Sai mật khẩu, vui lòng thử lại.';
          err.classList.remove('hidden');
          input.select();
        }
      } catch (netErr) {
        err.textContent = 'Không kết nối được máy chủ, kiểm tra lại mạng hoặc thử lại sau.';
        err.classList.remove('hidden');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Unlock'; }
      }
    }

    function exitFacilitatorMode() {
      isFacilitatorMode = false;
      facilitatorPasscode = null;
      saveFacilitatorSession();
      updateFacilitatorModeUI();
      updatePhaseBadgesUI();
      showToast('Exited Facilitator Mode (Audience View active)');

      // If viewing an unpublished tab, redirect to current active unlocked tab
      if (currentActiveTab !== 'home' && !publishedPhases[currentActiveTab]) {
        showLockedPhaseScreen(currentActiveTab);
      }
    }

    function updateFacilitatorModeUI() {
      const btn = document.getElementById('btnFacilitatorModeToggle');
      const dot = document.getElementById('facilitatorModeDot');
      const label = document.getElementById('facilitatorModeLabel');
      const panel = document.getElementById('facilitatorControlPanel');
      const overviewStatus = document.getElementById('overviewFacilitatorStatus');
      const lockedAction = document.getElementById('facilitatorLockedAction');

      if (isFacilitatorMode) {
        btn.className = "px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-[#FAC800] text-[#000054] border-yellow-500 hover:bg-amber-400";
        dot.className = "w-2 h-2 rounded-full bg-[#000054] animate-ping";
        label.textContent = "Facilitator (Exit)";
        panel.classList.remove('hidden');
        if (overviewStatus) overviewStatus.innerHTML = `<span class="bg-yellow-100 text-yellow-900 border border-yellow-300 px-2 py-0.5 rounded font-bold">Facilitator Controls Active</span>`;
        if (lockedAction) lockedAction.classList.remove('hidden');
      } else {
        btn.className = "px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100";
        dot.className = "w-2 h-2 rounded-full bg-slate-400";
        label.textContent = "Facilitator Mode";
        panel.classList.add('hidden');
        if (overviewStatus) overviewStatus.innerHTML = `<span>Audience View</span>`;
        if (lockedAction) lockedAction.classList.add('hidden');
      }
    }

    /* Toggle single phase publishing status (writes to shared state via Worker) */
    async function togglePhasePublish(phaseKey) {
      const next = { ...publishedPhases, [phaseKey]: !publishedPhases[phaseKey] };
      const ok = await pushSharedState(next);
      if (!ok) return;

      const phase = phaseConfig[phaseKey];
      const isPub = publishedPhases[phaseKey];
      showToast(`${phase.title.split(':')[0]} is now ${isPub ? 'PUBLISHED & AVAILABLE (mọi người tham dự đều thấy)' : 'LOCKED'}`);

      if (currentActiveTab === 'lockedPhase' && attemptedLockedTab === phaseKey && isPub) {
        actualSwitchTab(phaseKey);
      }
    }

    /* Bulk Actions */
    async function publishAllPhases(publishAll) {
      const next = {};
      Object.keys(publishedPhases).forEach(k => {
        next[k] = publishAll ? true : (k === 'sequence');
      });
      const ok = await pushSharedState(next);
      if (!ok) return;
      showToast(publishAll ? 'All phases are now LIVE for everyone!' : 'Reset: Only Phase 1 is published.');

      if (currentActiveTab === 'lockedPhase' && attemptedLockedTab && publishedPhases[attemptedLockedTab]) {
        actualSwitchTab(attemptedLockedTab);
      }
    }

    async function unlockNextPhase() {
      const order = ['sequence', 'challenge', 'studio', 'showcase'];
      const nextLocked = order.find(k => !publishedPhases[k]);
      if (nextLocked) {
        const next = { ...publishedPhases, [nextLocked]: true };
        const ok = await pushSharedState(next);
        if (!ok) return;
        showToast(`Published ${phaseConfig[nextLocked].title.split(':')[0]} for everyone!`);
        if (currentActiveTab === 'lockedPhase' && attemptedLockedTab === nextLocked) {
          actualSwitchTab(nextLocked);
        }
      } else {
        showToast('All phases are already published.');
      }
    }

    /* UI updates for badges across Nav, Cards, and Facilitator Control Bar */
    function updatePhaseBadgesUI() {
      const order = ['sequence', 'challenge', 'studio', 'showcase'];

      order.forEach(k => {
        const isPub = publishedPhases[k];

        // 1. Navigation Badge
        const navBadge = document.getElementById(`navBadge${capitalize(k)}`);
        if (navBadge) {
          if (isPub) {
            navBadge.className = "text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800";
            navBadge.textContent = "Live";
          } else {
            navBadge.className = "text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-500";
            navBadge.textContent = "🔒";
          }
        }

        // 2. Overview Card Badge & Action text
        const cardBadge = document.getElementById(`cardBadge${capitalize(k)}`);
        const cardAction = document.getElementById(`cardAction${capitalize(k)}`);
        const cardEl = document.getElementById(`cardPhase${capitalize(k)}`);

        if (cardBadge && cardAction && cardEl) {
          if (isPub) {
            cardBadge.className = "text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800";
            cardBadge.textContent = "Published";
            cardAction.innerHTML = `Start ${phaseConfig[k].title.split(':')[0]} &rarr;`;
            cardAction.className = "pt-2 flex items-center text-sm font-bold text-[#000054] group-hover:underline";
            cardEl.classList.remove('opacity-75');
          } else {
            cardBadge.className = "text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200";
            cardBadge.textContent = "🔒 Locked";
            cardAction.innerHTML = `<span class="text-amber-800 flex items-center gap-1 font-semibold"><span>🔒 Locked</span> <span class="text-xs text-slate-400 font-normal">(Click for status)</span></span>`;
            cardEl.classList.add('opacity-75');
          }
        }

        // 3. Facilitator Control Panel Cards (Clean and obvious)
        const panelCard = document.getElementById(`panelCard${capitalize(k)}`);
        const panelStatus = document.getElementById(`panelStatus${capitalize(k)}`);
        const panelBtn = document.getElementById(`panelBtn${capitalize(k)}`);

        if (panelCard && panelStatus && panelBtn) {
          if (isPub) {
            panelCard.className = "flex items-center justify-between p-1.5 px-3 rounded-lg border border-emerald-500/50 bg-emerald-950/40 gap-2";
            panelStatus.className = "text-[10px] font-black uppercase tracking-wider text-emerald-400";
            panelStatus.textContent = "PUBLISHED ✓";
            panelBtn.className = "px-2 py-1 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition shadow-sm";
            panelBtn.textContent = "Lock";
          } else {
            panelCard.className = "flex items-center justify-between p-1.5 px-3 rounded-lg border border-slate-700 bg-slate-800/80 gap-2";
            panelStatus.className = "text-[10px] font-black uppercase tracking-wider text-slate-400";
            panelStatus.textContent = "LOCKED 🔒";
            panelBtn.className = "px-2.5 py-1 rounded text-[11px] font-bold bg-[#E60028] hover:bg-[#b80020] text-white transition shadow-sm";
            panelBtn.textContent = "Publish";
          }
        }
      });
    }

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /* Guarded Navigation */
    function navigateTo(tabId) {
      if (tabId === 'home') {
        actualSwitchTab('home');
        return;
      }

      // Check if phase is published
      const isPub = publishedPhases[tabId];

      if (!isPub) {
        // Audience / Locked: show clear locked notice screen
        showLockedPhaseScreen(tabId);
        return;
      }

      actualSwitchTab(tabId);
    }

    /* Display Locked Phase Screen */
    function showLockedPhaseScreen(phaseKey) {
      attemptedLockedTab = phaseKey;
      const phase = phaseConfig[phaseKey];

      document.getElementById('lockedPhaseTitle').textContent = phase.title;
      document.getElementById('lockedPhasePill').textContent = `Phase ${phase.phaseNumber} • Unpublished`;

      const publishBtn = document.getElementById('btnPublishThisPhaseNow');
      if (publishBtn) {
        publishBtn.textContent = `Publish ${phase.title.split(':')[0]} to Audience Now`;
      }

      const lockedAction = document.getElementById('facilitatorLockedAction');
      if (lockedAction) {
        if (isFacilitatorMode) {
          lockedAction.classList.remove('hidden');
        } else {
          lockedAction.classList.add('hidden');
        }
      }

      actualSwitchTab('lockedPhase');
    }

    async function publishCurrentLockedPhase() {
      if (!attemptedLockedTab) return;
      const next = { ...publishedPhases, [attemptedLockedTab]: true };
      const ok = await pushSharedState(next);
      if (!ok) return;
      showToast(`Published ${phaseConfig[attemptedLockedTab].title.split(':')[0]} for everyone! Entering now...`);
      actualSwitchTab(attemptedLockedTab);
    }

    function navigateToLatestUnlocked() {
      const order = ['showcase', 'studio', 'challenge', 'sequence'];
      const latest = order.find(k => publishedPhases[k]) || 'sequence';
      actualSwitchTab(latest);
    }

    /* Core Tab Switching Logic */
    function actualSwitchTab(tabId) {
      currentActiveTab = tabId;

      const tabs = {
        home: document.getElementById('tabHome'),
        sequence: document.getElementById('tabSequence'),
        challenge: document.getElementById('tabChallenge'),
        studio: document.getElementById('tabStudio'),
        showcase: document.getElementById('tabShowcase'),
        lockedPhase: document.getElementById('tabLockedPhase')
      };

      const btns = {
        home: document.getElementById('tabBtnHome'),
        sequence: document.getElementById('tabBtnSequence'),
        challenge: document.getElementById('tabBtnChallenge'),
        studio: document.getElementById('tabBtnStudio'),
        showcase: document.getElementById('tabBtnShowcase'),
      };

      Object.keys(tabs).forEach(k => {
        if (!tabs[k]) return;
        if (k === tabId) {
          tabs[k].classList.remove('hidden');
        } else {
          tabs[k].classList.add('hidden');
        }
      });

      Object.keys(btns).forEach(k => {
        if (!btns[k]) return;
        if (k === tabId) {
          btns[k].className = "px-2.5 sm:px-3 py-1.5 rounded-md font-bold text-white bg-[#000054] transition shadow-sm flex items-center gap-1.5";
        } else {
          btns[k].className = "px-2.5 sm:px-3 py-1.5 rounded-md font-medium text-slate-700 hover:text-[#000054] hover:bg-slate-200 transition flex items-center gap-1.5";
        }
      });

      if (tabId === 'studio') generateCleanPrompt();
      if (tabId === 'challenge') renderStickyNotes();

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Option-Specific Poll Feedback
    const pollFeedbackData = {
      A: {
        type: 'warning',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        titleColor: 'text-amber-900',
        badge: 'Assumptive Approach',
        text: '"Fast," "convenient," and "sleek" are subjective buzzwords, not engineering specs. Designing immediately means you are building based on your own assumptions rather than what the campus community actually needs.'
      },
      B: {
        type: 'warning',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        titleColor: 'text-amber-900',
        badge: 'Context Mismatch',
        text: 'While reusing proven components saves time, copy-pasting specs ignores this specific environment, like peak rush hours between classes and accessibility requirements.'
      },
      C: {
        type: 'success',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        titleColor: 'text-emerald-900',
        badge: 'Best Approach',
        text: 'Best approach. Clients describe symptoms and wishes, not functional specs. Probing their context, user habits, and physical environment helps you translate vague adjectives into measurable engineering requirements.'
      },
      D: {
        type: 'error',
        bg: 'bg-rose-50',
        border: 'border-rose-300',
        titleColor: 'text-rose-900',
        badge: 'Stakeholder Friction',
        text: 'Clients are domain experts in their own needs, not systems engineers. Demanding ready-made technical specs from them shifts your core engineering responsibility back onto the stakeholder.'
      }
    };

    function voteCanvasPoll(selected) {
      const counts = { A: 4, B: 6, C: 42, D: 8 };
      counts[selected] += 1;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      ['A', 'B', 'C', 'D'].forEach(opt => {
        const pct = Math.round((counts[opt] / total) * 100);
        document.getElementById(`percent${opt}`).textContent = `${pct}%`;
        document.getElementById(`bar${opt}`).style.width = `${pct}%`;
        
        const card = document.getElementById(`pollOpt${opt}`);
        if (opt === selected) {
          card.classList.add('ring-2', 'ring-[#000054]', 'bg-blue-50/40');
        } else {
          card.classList.remove('ring-2', 'ring-[#000054]', 'bg-blue-50/40');
        }
      });

      const fb = pollFeedbackData[selected];
      const fbBox = document.getElementById('canvasPollFeedback');
      fbBox.className = `mt-3 p-3.5 rounded-lg border text-xs sm:text-sm ${fb.bg} ${fb.border}`;
      fbBox.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
          <strong class="${fb.titleColor}">${fb.badge} (Option ${selected})</strong>
        </div>
        <p class="text-slate-800 leading-relaxed">${fb.text}</p>
      `;
      fbBox.classList.remove('hidden');

      showToast(`Selected Option ${selected}. Feedback revealed.`);
    }

    // Challenge Option Switcher
    let currentChallengeOpt = 1;
    const challengeMeta = {
      1: {
        name: "Option 1: Colour Theory in Digital Design",
        learners: "2nd-year undergraduate students in Graphic Design, Web UX, or Digital Media.",
        about: "An interactive digital colour palette tester with hue, saturation, and lightness sliders, live button preview, and a simulated bright sunlight / colour-blindness toggle filter.",
        friction: "Students realise that aesthetically pleasing colours fail under bright sunlight or colour blindness. The simulation causes them to fail WCAG contrast checks when adjusting hue sliders.",
        postTask: "Adjust their palette until it passes WCAG AA contrast, and write 3 verifiable engineering requirements for their mobile app interface."
      },
      2: {
        name: "Option 2: Event Budget Planning",
        learners: "Undergraduate Event Management, Tourism, or Business Administration students.",
        about: "A dynamic budget simulator for a 300-person campus festival with attendee counter, fixed vs. variable cost toggles, and unexpected scenario cards.",
        friction: "Students allocate 100% of their funds with 0% contingency buffer; when a surprise tent rental card triggers, their budget goes immediately into deficit.",
        postTask: "Calculate the exact breakeven point per attendee and rewrite the commercial proposal with a mandatory 15% emergency contingency reserve."
      },
      3: {
        name: "Option 3: Three-Point Studio Lighting",
        learners: "Media Production, Film, and Digital Journalism students.",
        about: "A virtual studio mockup with Key, Fill, and Hair light sliders (intensity, angle, colour temperature) illuminating an on-screen subject portrait.",
        friction: "Turning off or maxing the Fill light creates unflattering harsh shadows or flattens depth into a washed-out, lifeless 2D passport-photo look.",
        postTask: "Document the key-to-fill ratio used and explain in 3 verifiable criteria how their lighting setup achieves the assigned dramatic scene mood."
      }
    };

    function selectChallengeOption(optNum) {
      currentChallengeOpt = optNum;

      [1, 2, 3].forEach(num => {
        const btn = document.getElementById(`btnChallengeOpt${num}`);
        const content = document.getElementById(`contentChallengeOpt${num}`);
        const accentBar = document.getElementById(`accentBarOpt${num}`);

        if (num === optNum) {
          if (num === 1) btn.className = "p-5 text-left rounded-xl border-2 border-indigo-600 bg-indigo-50/70 text-slate-900 transition flex flex-col justify-between shadow-sm relative overflow-hidden";
          if (num === 2) btn.className = "p-5 text-left rounded-xl border-2 border-emerald-600 bg-emerald-50/70 text-slate-900 transition flex flex-col justify-between shadow-sm relative overflow-hidden";
          if (num === 3) btn.className = "p-5 text-left rounded-xl border-2 border-amber-500 bg-amber-50/70 text-slate-900 transition flex flex-col justify-between shadow-sm relative overflow-hidden";
          if (accentBar) accentBar.classList.remove('opacity-0');
          content.classList.remove('hidden');
        } else {
          btn.className = "p-5 text-left rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 text-slate-700 transition flex flex-col justify-between relative overflow-hidden";
          if (accentBar) accentBar.classList.add('opacity-0');
          content.classList.add('hidden');
        }
      });

      document.getElementById('currentSequenceBanner').textContent = challengeMeta[optNum].name;
      renderStickyNotes();
      showToast(`Selected ${challengeMeta[optNum].name}`);
    }

    // Streamlined Sticky Notes
    const defaultStickyNotes = [
      {
        id: 1,
        opt: 1,
        author: "Group 1",
        text: "Students choose trendy light-grey on white. It looks clean indoors, but completely fails under sunlight. Activity: Slider for outdoor glare."
      },
      {
        id: 2,
        opt: 1,
        author: "Group 4",
        text: "Outcome: Students calibrate button contrast to WCAG 4.5:1 before designing their final assessment page."
      },
      {
        id: 3,
        opt: 2,
        author: "Group 2",
        text: "Outcome: Students experience a surprise rain marquee bill that wipes out their budget without a 15% contingency buffer."
      },
      {
        id: 4,
        opt: 3,
        author: "Group 5",
        text: "Outcome: Students understand key-to-fill lighting ratios by toggling a fill dimmer to see unflattering harsh shadows disappear."
      }
    ];

    let stickyNotes = [];
    try {
      const saved = localStorage.getItem('rmit_challenge_stickies_v2');
      stickyNotes = saved ? JSON.parse(saved) : defaultStickyNotes;
    } catch(e) {
      stickyNotes = defaultStickyNotes;
    }

    function saveStickyNotes() {
      try {
        localStorage.setItem('rmit_challenge_stickies_v2', JSON.stringify(stickyNotes));
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
        opt: currentChallengeOpt,
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

    function sendStickyToPrompt(id) {
      const note = stickyNotes.find(n => n.id === id);
      if (!note) return;

      const meta = challengeMeta[note.opt] || challengeMeta[currentChallengeOpt];
      document.getElementById('inputGoalFriction').value = note.text;
      document.getElementById('inputLearners').value = meta.learners;
      document.getElementById('inputSimulationAbout').value = meta.about;
      document.getElementById('inputPostTask').value = meta.postTask;

      navigateTo('studio');
      generateCleanPrompt();
      showToast('Transferred note to AI Prompt Tool!');
    }

    function transferActiveNotesToStudio() {
      const relevant = stickyNotes.filter(n => n.opt === currentChallengeOpt);
      const meta = challengeMeta[currentChallengeOpt];

      document.getElementById('inputGoalFriction').value = relevant.length > 0 ? relevant[0].text : meta.friction;
      document.getElementById('inputLearners').value = meta.learners;
      document.getElementById('inputSimulationAbout').value = meta.about;
      document.getElementById('inputPostTask').value = meta.postTask;

      navigateTo('studio');
      generateCleanPrompt();
      showToast('Transferred group ideas to AI Prompt Tool!');
    }

    function renderStickyNotes() {
      const container = document.getElementById('stickyNotesGrid');
      if (!container) return;

      const filtered = stickyNotes.filter(n => n.opt === currentChallengeOpt);

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-6 text-center text-slate-400 text-xs sm:text-sm border-2 border-dashed border-slate-200 rounded-xl">
            No sticky notes for this topic yet. Add your group's outcome above!
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(n => `
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

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Requirements Table Handling
    function handleReqChange(selectEl) {
      const selectedValue = selectEl.value;
      const correctAnswer = selectEl.getAttribute('data-correct');
      const row = selectEl.closest('tr');
      const container = selectEl.closest('.dropdown-container');
      const icon = container.querySelector('.feedback-icon');
      const feedbackCell = row.querySelector('.feedback-cell');
      const feedbackMsg = feedbackCell.getAttribute('data-feedback');

      row.classList.remove('req-row-correct', 'req-row-incorrect');
      icon.textContent = '';
      feedbackCell.textContent = '';

      if (selectedValue !== 'Select') {
        if (selectedValue === correctAnswer) {
          row.classList.add('req-row-correct');
          icon.textContent = '✔';
          feedbackCell.textContent = feedbackMsg;
        } else {
          row.classList.add('req-row-incorrect');
          icon.textContent = '✖';
          feedbackCell.textContent = 'Incorrect. Try again!';
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

    // Prompt Generation
    function generateCleanPrompt() {
      const goalFriction = document.getElementById('inputGoalFriction').value.trim() || 
        "Students realise that client wish lists ('make it fast and modern') fail to capture real human constraints. The simulation introduces deliberate cognitive friction that causes students to pause and observe their own hesitation.";

      const learners = document.getElementById('inputLearners').value.trim() || 
        "Undergraduate university students in Systems Engineering, UX Design, or Human-Centred Computing.";

      const simAbout = document.getElementById('inputSimulationAbout').value.trim() || 
        "A campus or public service interactive machine (such as a metro ticket kiosk, library checkout, or hospital check-in terminal) with touch buttons, step-by-step state screen, and card/dispense mechanisms.";
      
      const postTask = document.getElementById('inputPostTask').value.trim() || 
        "Students log the exact moment they hesitated, identify 3 unstated user needs, and translate them into Specific, Measurable, and Verifiable engineering requirements.";

      const prompt = `Act as an expert Educational Technologist and Simulation Software Engineer.

Task:
Develop a self-contained, single-file interactive web simulation (HTML/CSS/JS) designed as an active learning trigger for university students.

1. Learning Goal & Intentional Cognitive Friction:
- The simulation must not be a smooth, frictionless demo.
- Deliberately embed this specific hesitation dilemma:
  ${goalFriction}
- The core pedagogical objective is to give students direct experiential evidence of unstated user needs.

2. Target Learners:
${learners}

3. System & Behaviours to Simulate:
${simAbout}

4. Post-Simulation Student Task:
- The simulation serves as raw material for the following follow-up exercise:
  ${postTask}

Technical Guidelines:
- Single runnable HTML file using Tailwind CSS CDN and Vanilla JavaScript or React (via UMD).
- Clean, high-contrast, accessible light-mode interface with a strict white background (#ffffff) across all components.
- Responsive layout suited for standard browser viewports (desktop and laptop).
- State-driven display (Idle, Selecting, Processing, Friction Alert, Complete).
- Include an embedded "Observer Note Box" where students can jot down moments they felt confused or hesitated during the exercise.

Generate the complete, working code now.`;

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
        showToast('Prompt copied to clipboard! Paste it into Gemini.');
      } catch (err) {
        showToast('Please select and copy the text manually.');
      }
      document.body.removeChild(temp);
    }

    // Sequence & Simulation Embedder Drag-and-Drop & Compiler
    const sequenceTemplates = {
      1: {
        title: "Colour Theory in Digital Design",
        hook: `<div class="mb-6"><h2 class="text-2xl font-bold text-[#000054] mb-2">Colour Theory in Digital Design</h2><p class="text-slate-600 text-sm">Context: You are currently working in design teams to create a mobile app for campus students. Before finalising your high-fidelity user interface, work through this guide to understand how colour choices directly impact user experience and navigation.</p><h3 class="text-lg font-bold text-slate-900 mt-4 mb-2">Why does colour matter?</h3><p class="text-slate-700 leading-relaxed">Have you ever visited a website and immediately felt overwhelmed, or struggled to read light-grey text on a white background? Colour isn't just decoration—it quietly guides how people feel, where they look, and whether an app feels intuitive or exhausting to use.</p></div>`,
        concept: `<div class="mb-6"><h3 class="text-lg font-bold text-slate-900 mb-2">The Colour Wheel: Harmony &amp; Contrast</h3><p class="text-slate-700 leading-relaxed mb-3">You don't need an art degree to build a great palette. Most everyday choices come down to two basic ideas: Complementary Colours (high contrast, grabs attention for warning badges or primary buttons) and Analogous Colours (calm, cohesive, and easy on the eyes).</p><div class="p-3.5 rounded-lg bg-blue-50 border-l-4 border-[#000054] text-slate-800 text-sm mb-4"><strong>The Catch: Contrast and Legibility:</strong> A combination might look aesthetic to you, but if a student in bright sunlight or someone with colour vision differences can't read it, the design fails.</div></div>`,
        wrapup: `<div class="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-slate-800 text-sm"><strong class="text-[#000054]">Assessment Task Connection:</strong> In your final assessment, you must submit an accessible mobile app landing page. Test your palette against WCAG AA requirements before finalising your design.</div>`
      },
      2: {
        title: "Event Budget Planning",
        hook: `<div class="mb-6"><h2 class="text-2xl font-bold text-[#000054] mb-2">Event Budget Planning</h2><p class="text-slate-600 text-sm">Context: Your committee is organising a commercial campus event for 300 attendees. Before pitching your financial plan to the sponsors, review this foundational guide on managing fixed versus variable operational expenses.</p><h3 class="text-lg font-bold text-slate-900 mt-4 mb-2">Where does all the money go?</h3><p class="text-slate-700 leading-relaxed">Organising an event is exciting until the bills arrive. The number-one reason campus festivals run into trouble isn't a lack of great ideas—it's surprise costs that spiral out of control.</p></div>`,
        concept: `<div class="mb-6"><h3 class="text-lg font-bold text-slate-900 mb-2">Two Buckets: Fixed vs. Variable Costs</h3><p class="text-slate-700 leading-relaxed mb-3">Fixed costs (venue hire, permits, sound gear) stay the same whether 10 or 300 people arrive. Variable costs (catering, drinks, badges) scale up with every attendee.</p><div class="p-3.5 rounded-lg bg-emerald-50 border-l-4 border-emerald-600 text-slate-800 text-sm mb-4"><strong>The Golden Rule: The Contingency Buffer:</strong> Planners always set aside a 10% to 15% rainy-day buffer. If you don't budget for surprises upfront, they come out of your own pocket.</div></div>`,
        wrapup: `<div class="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-slate-800 text-sm"><strong class="text-[#000054]">Assessment Task Connection:</strong> For your main project, submit a viable commercial budget for 300 attendees that accounts for unexpected vendor cost increases.</div>`
      },
      3: {
        title: "Three-Point Studio Lighting",
        hook: `<div class="mb-6"><h2 class="text-2xl font-bold text-[#000054] mb-2">Three-Point Studio Lighting</h2><p class="text-slate-600 text-sm">Context: As part of your upcoming digital video assessment, you must light and record an interview subject in the broadcast studio. Learn how to transform flat camera imagery into three-dimensional cinematic depth.</p><h3 class="text-lg font-bold text-slate-900 mt-4 mb-2">Why do smartphone videos look flat?</h3><p class="text-slate-700 leading-relaxed">Cameras flatten a three-dimensional world onto a 2D screen. Lighting is the cinematic craft that reintroduces depth, shape, and emotion.</p></div>`,
        concept: `<div class="mb-6"><h3 class="text-lg font-bold text-slate-900 mb-2">The Classic Three-Light Recipe</h3><p class="text-slate-700 leading-relaxed mb-3">Professional shoots balance the Key light (hero shape &amp; shadows), Fill light (gentle shadow softener), and Back light / Hair light (separating the subject from the background wall).</p><div class="p-3.5 rounded-lg bg-amber-50 border-l-4 border-amber-500 text-slate-800 text-sm mb-4"><strong>The Catch: Mood and Balance:</strong> Adjusting just one dimmer switch completely changes the story—from an upbeat corporate interview to a moody thriller scene.</div></div>`,
        wrapup: `<div class="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-slate-800 text-sm"><strong class="text-[#000054]">Assessment Task Connection:</strong> In your studio practical assessment, light a live actor to match your assigned emotional scene script.</div>`
      }
    };

    function handleDragOver(e) {
      e.preventDefault();
      document.getElementById('simDropzone').classList.add('border-[#000054]', 'bg-blue-50');
    }

    function handleDragLeave(e) {
      e.preventDefault();
      document.getElementById('simDropzone').classList.remove('border-[#000054]', 'bg-blue-50');
    }

    function handleFileDrop(e) {
      e.preventDefault();
      document.getElementById('simDropzone').classList.remove('border-[#000054]', 'bg-blue-50');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
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
      const optVal = document.getElementById('embedSequenceOption').value;
      const posVal = document.getElementById('embedPlacementPosition').value;
      
      let rawSimCode = document.getElementById('embedSimCode').value.trim();
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
    <p class="text-slate-600 text-sm">Your bespoke AI-generated simulation will run interactively inside this container with strict white background isolation.</p>
    <button class="px-5 py-2.5 bg-[#000054] text-white rounded-lg font-bold text-sm hover:bg-[#00003c] transition shadow">Interact with System</button>
  </div>
</body>
</html>`;
      }

      let sanitizedSimCode = rawSimCode;
      const whiteBgOverride = `<style>
        html, body { 
          background-color: #ffffff !important; 
          background: #ffffff !important; 
        }
      </style>`;

      if (sanitizedSimCode.toLowerCase().includes('</head>')) {
        sanitizedSimCode = sanitizedSimCode.replace(/<\/head>/i, `${whiteBgOverride}</head>`);
      } else if (sanitizedSimCode.toLowerCase().includes('<body')) {
        sanitizedSimCode = whiteBgOverride + sanitizedSimCode;
      } else {
        sanitizedSimCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"><\/script>
  ${whiteBgOverride}
</head>
<body style="background-color: #ffffff !important; margin: 0; padding: 16px;">
  ${sanitizedSimCode}
</body>
</html>`;
      }

      const escapedSrcdoc = sanitizedSimCode
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');

      const simContainer = `
        <div class="my-8 rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden" style="background-color: #ffffff !important;">
          <div class="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-[#000054] flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#E60028]"></span>
              <span>Active Learning Trigger (Interactive Simulation)</span>
            </span>
            <span class="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded">Isolated Sandboxed Environment</span>
          </div>
          <div class="p-2 sm:p-4 bg-white" style="background-color: #ffffff !important;">
            <iframe 
              srcdoc="${escapedSrcdoc}"
              class="w-full min-h-[640px] border-0 rounded-lg bg-white block" 
              style="background-color: #ffffff !important; width: 100%; border: none;"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="Embedded Learning Simulation"
            ></iframe>
          </div>
        </div>
      `;

      let assembledContent = '';
      if (optVal === 'custom') {
        const customText = document.getElementById('embedCustomSeqText').value.trim() || `<h2 class="text-2xl font-bold text-[#000054] mb-2">Custom Learning Sequence</h2><p class="text-slate-700">Explore the concept and interact with the simulation below.</p>`;
        const customHeader = `
          <div class="bg-gradient-to-r from-[#000054] to-[#0a1240] p-6 rounded-xl text-white mb-6 border-b-4 border-[#FAC800] shadow-sm flex items-center justify-between">
            <div>
              <span class="bg-[#FAC800] text-[#000054] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Active Course Sequence</span>
              <h2 class="text-xl font-bold mt-1 text-white">Custom Topic Draft</h2>
            </div>
            <span class="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-400/40 px-2.5 py-1 rounded font-medium">✓ Integrated</span>
          </div>
        `;
        assembledContent = `${customHeader}<div class="prose max-w-none text-slate-800">${customText}</div>${simContainer}`;
      } else {
        const tmpl = sequenceTemplates[optVal];
        const previewSeqHeader = `
          <div class="bg-gradient-to-r from-[#000054] to-[#0a1240] p-6 rounded-xl text-white mb-6 border-b-4 border-[#FAC800] shadow-sm flex items-center justify-between">
            <div>
              <span class="bg-[#FAC800] text-[#000054] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Active Course Sequence</span>
              <h2 class="text-xl font-bold mt-1 text-white">${tmpl.title}</h2>
            </div>
            <span class="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-400/40 px-2.5 py-1 rounded font-medium">✓ Embedded with Simulation</span>
          </div>
        `;

        if (posVal === 'section1') {
          assembledContent = `${previewSeqHeader}${tmpl.hook}${simContainer}${tmpl.concept}${tmpl.wrapup}`;
        } else if (posVal === 'section3') {
          assembledContent = `${previewSeqHeader}${tmpl.hook}${tmpl.concept}${simContainer}${tmpl.wrapup}`;
        } else {
          assembledContent = `${previewSeqHeader}${tmpl.hook}${tmpl.concept}${simContainer}${tmpl.wrapup}`;
        }
      }

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compiled Learning Sequence Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    html, body { 
      background-color: #ffffff !important; 
      background: #ffffff !important; 
      color: #1e293b; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
      margin: 0; 
      padding: 24px; 
      font-size: 15px; 
      line-height: 1.6;
    }
  </style>
</head>
<body style="background-color: #ffffff !important;">
  <div class="max-w-4xl mx-auto space-y-4">
    ${assembledContent}
  </div>
</body>
</html>`;
    }

    function compileCompleteSequence() {
      const compiledDoc = generateCompiledDocument();
      const iframe = document.getElementById('compiledPreviewFrame');
      iframe.srcdoc = compiledDoc;
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

    // Accessible Toast Notifications
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

    // Initialize State on Page Load
    window.addEventListener('DOMContentLoaded', async () => {
      document.querySelectorAll('.req-table select').forEach(sel => {
        const saved = localStorage.getItem('rmit_canvas_req_' + sel.id);
        if (saved) {
          sel.value = saved;
          handleReqChange(sel);
        }
      });
      updateFacilitatorModeUI();
      await fetchSharedState(); // get the live, shared publish state for every participant
      startStatePolling();      // keep checking so everyone sees facilitator changes without reloading
      generateCleanPrompt();
      renderStickyNotes();
      compileCompleteSequence();
    });
