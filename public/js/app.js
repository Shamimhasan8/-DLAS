/**
 * ডিজিটাল আইনি সেবা (DLAS) — SPA Router & Complete Portal Frontend
 * Five Doors, One Record. Integrated Digital Legal Aid System for Bangladesh.
 */
'use strict';

// ---------- ছোট helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');

let BOOT = null;           // /api/bootstrap থেকে আসা ডেটা
let ME = null;             // লগইন করা ইউজার
const bnNum = (s) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

async function apiGet(name, params = {}) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch('/api/' + name + (q ? '?' + q : ''));
  return r.json();
}
async function apiPost(name, body) {
  try {
    const r = await fetch('/api/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return await r.json();
  } catch (err) {
    console.error('apiPost error:', err);
    return { error: 'সার্ভার যোগাযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' };
  }
}

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ---------- থিম / ভাষা / a11y ----------
function initShell() {
  // ভাষা টগল
  const savedLang = localStorage.getItem('lang') || 'bn';
  document.documentElement.lang = savedLang;
  const langToggleBtn = $('#langToggle');
  if (langToggleBtn) {
    langToggleBtn.textContent = savedLang === 'en' ? 'বাং বাংলা' : '文A English';
    langToggleBtn.onclick = () => {
      const next = document.documentElement.lang === 'bn' ? 'en' : 'bn';
      document.documentElement.lang = next;
      localStorage.setItem('lang', next);
      langToggleBtn.textContent = next === 'en' ? 'বাং বাংলা' : '文A English';
      if (typeof applyI18n === 'function') applyI18n();
      route();
    };
  }

  // প্রবেশগম্যতা
  const a11y = JSON.parse(localStorage.getItem('a11y') || '{}');
  if (a11y.fscale) document.documentElement.style.setProperty('--fscale', a11y.fscale);
  if (a11y.contrast) document.documentElement.dataset.contrast = 'high';
  const a11yToggle = $('#a11yToggle');
  if (a11yToggle) a11yToggle.onclick = () => $('#a11yPanel').classList.toggle('hidden');
  const floatingA11y = $('#floatingA11yBtn');
  if (floatingA11y) {
    floatingA11y.onclick = () => $('#a11yPanel').classList.toggle('hidden');
  }
  const fsInc = $('#fsInc');
  if (fsInc) fsInc.onclick = () => setFscale(Math.min(1.5, (a11y.fscale || 1) + .1));
  const fsDec = $('#fsDec');
  if (fsDec) fsDec.onclick = () => setFscale(Math.max(.8, (a11y.fscale || 1) - .1));
  const contrastToggle = $('#contrastToggle');
  if (contrastToggle) {
    contrastToggle.onclick = () => {
      const on = document.documentElement.dataset.contrast === 'high';
      if (on) delete document.documentElement.dataset.contrast;
      else document.documentElement.dataset.contrast = 'high';
      a11y.contrast = !on;
      localStorage.setItem('a11y', JSON.stringify(a11y));
    };
  }
  const a11yReset = $('#a11yReset');
  if (a11yReset) {
    a11yReset.onclick = () => {
      localStorage.removeItem('a11y');
      location.reload();
    };
  }
  function setFscale(v) {
    a11y.fscale = Math.round(v * 10) / 10;
    document.documentElement.style.setProperty('--fscale', a11y.fscale);
    localStorage.setItem('a11y', JSON.stringify(a11y));
  }

  // মোবাইল মেনু
  const navBurger = $('#navBurger');
  const mainNav = $('#mainNav');
  if (navBurger && mainNav) {
    navBurger.onclick = (e) => {
      e.stopPropagation();
      const isOpen = mainNav.classList.toggle('open');
      navBurger.setAttribute('aria-expanded', isOpen);
      navBurger.textContent = isOpen ? '✕' : '☰';
    };
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navBurger.textContent = '☰';
      });
    });
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !navBurger.contains(e.target)) {
        mainNav.classList.remove('open');
        navBurger.textContent = '☰';
      }
    });
  }

  // চ্যাট উইজেট
  initChatBot();
}

// ---------- চ্যাটবট লজিক (Bangla + Banglish + English + Web/Legal Search) ----------
function initChatBot() {
  const chatBody = $('#chatBody');
  const chatWidget = $('#chatWidget');
  const chatFab = $('#chatFab');
  const chatClose = $('#chatClose');
  const chatForm = $('#chatForm');
  const chatText = $('#chatText');

  if (!chatFab || !chatWidget) return;

  const chatOpen = () => {
    chatWidget.classList.remove('hidden');
    if (chatText) chatText.focus();
  };
  chatFab.onclick = () => {
    if (chatWidget.classList.contains('hidden')) chatOpen();
    else chatWidget.classList.add('hidden');
  };
  if (chatClose) chatClose.onclick = () => chatWidget.classList.add('hidden');
  window.__chatOpen = chatOpen;

  const renderActions = (r) => {
    if (!r.actions && !r.action) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-actions';
    const mkBtn = (html, cls, fn) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-chip ' + cls;
      btn.innerHTML = html;
      btn.onclick = fn;
      return btn;
    };
    if (r.action && r.action.route) {
      wrap.appendChild(mkBtn(esc(r.action.label || r.action.route), 'primary', () => {
        chatWidget.classList.add('hidden');
        location.hash = r.action.route;
      }));
    }
    const acts = {
      home: ['#/', '🏠 হোম'],
      library: ['#/topics', '📚 আইনি তথ্য'],
      guide: ['#/guide', '🧭 পরামর্শ গাইড'],
      apply: ['#/apply', '📝 আবেদন করুন'],
      track: ['#/track', '📦 ট্র্যাকিং'],
      offices: ['#/offices', '🗺️ অফিস খুঁজুন'],
      news: ['#/news', '📰 নিউজ ও ইভেন্ট'],
      help: ['#/help', '🤝 সহায়তা চ্যানেল'],
      call: ['#/call', '📞 কল ১৬৬৯৯'],
      dashboard: ['#/dashboard', '👤 ড্যাশবোর্ড']
    };
    for (const key of r.actions || []) {
      const a = acts[key];
      if (!a) continue;
      wrap.appendChild(mkBtn(a[1], '', () => {
        chatWidget.classList.add('hidden');
        location.hash = a[0];
      }));
    }
    if (wrap.children.length) chatBody.appendChild(wrap);
  };

  const renderQuick = (r) => {
    if (!r.quick || !r.quick.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-actions quick';
    for (const q of r.quick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-chip';
      btn.textContent = q;
      btn.onclick = () => {
        sendChat(q);
      };
      wrap.appendChild(btn);
    }
    chatBody.appendChild(wrap);
  };

  // Client-side local smart search & fallback knowledge base
  function localSmartSearch(raw) {
    const q = raw.toLowerCase().trim();
    const isEn = document.documentElement.lang === 'en' || /^[a-z0-9\s.,?!]+$/.test(q);

    // 1. Greetings
    if (/\b(hi|hello|hey|salam|assalamu|nomoskar|কেমন)\b/i.test(q)) {
      return {
        reply: isEn
          ? "Hello! 👋 I am your Digital Legal Aid Assistant. You can ask me any question about legal procedures, free counsel, court petitions, mediation, or land rights in Bangladesh."
          : "আসসালামু আলাইকুম! 👋 আমি আপনার ডিজিটাল আইনি সহকারী। সরকারি খরচে বিনামূল্যে আইনি পরামর্শ, আইনজীবী নিয়োগ, পারিবারিক বা জমির বিরোধ নিষ্পত্তি সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।",
        actions: ['apply', 'track', 'library', 'offices', 'help'],
        quick: isEn ? ['How to apply for legal aid?', 'Is it free?', 'Track application', 'Land dispute'] : ['কীভাবে আবেদন করব?', 'সেবা কি সম্পূর্ণ ফ্রি?', 'আবেদন ট্র্যাক করব কীভাবে?', 'জমির সমস্যা']
      };
    }

    // 2. Divorce / Family
    if (/(তালাক|বিবাহবিচ্ছেদ|দেনমোহর|ভরণপোষণ|খোরপোশ|divorce|talaq|talak|denmohor|maintenance|dower)/i.test(q)) {
      return {
        reply: isEn
          ? "Under the Muslim Family Laws Ordinance 1961, divorce requires written notice to the Union Parishad Chairman/Mayor and a copy to the spouse. The notice takes effect after 90 days. For dower or maintenance, you can file directly in the Family Court under the Family Courts Act 2023 without court fees, or apply for free legal aid through DLAS."
          : "মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১ অনুযায়ী তালাকের ক্ষেত্রে চেয়ারম্যান/মেয়র বরাবর লিখিত নোটিশ পাঠাতে হয় এবং স্ত্রী/স্বামীকে অনুলিপি দিতে হয়। নোটিশ প্রাপ্তির ৯০ দিন পর এটি কার্যকর হয়। দেনমোহর ও ভরণপোষণের জন্য পারিবারিক আদালত আইন ২০২৩ অনুযায়ী বিনামূল্যে সরকারি লিগ্যাল এইডের সহায়তায় সরাসরি মামলা বা মধ্যস্থতা করা যায়।",
        action: { route: '#/topic/family', label: '📖 পারিবারিক আইনি তথ্য দেখুন' },
        actions: ['apply', 'guide', 'library'],
        quick: ['দেনমোহর আদায়ের নিয়ম', 'সন্তানের হেফাজত', 'আবেদন ফরম খুলুন']
      };
    }

    // 3. Land / Property
    if (/(জমি|দলিল|খতিয়ান|পর্চা|নামজারি|দখল|উচ্ছেদ|land|mutation|property|jomir|jomi|dokhol)/i.test(q)) {
      return {
        reply: isEn
          ? "For land disputes, fraudulent deeds, or unauthorized occupation, you can seek legal protection. Under the Land Reform Act and Specific Relief Act, you can file a suit for recovery of possession or challenge forged documents. District Legal Aid Offices provide free panel lawyers for eligible citizens."
          : "জমি জবরদখল, ভুয়া দলিল বা নামজারি জটিলতার ক্ষেত্রে নির্দিষ্ট প্রতিকার আইন ও ভূমি আইনের অধীনে দেওয়ানি আদালতে মামলা বা জেলা লিগ্যাল এইড অফিসে মধ্যস্থতার আবেদন করা যায়। সরকারি খরচে প্যানেল আইনজীবী পেতে এখনই আবেদন দাখিল করতে পারেন।",
        action: { route: '#/topic/land', label: '📖 ভূমি ও বাসস্থান অধিকার দেখুন' },
        actions: ['apply', 'library', 'offices'],
        quick: ['জমি দখলমুক্ত করার উপায়', 'ভুয়া দলিল বাতিল', 'নতুন আবেদন']
      };
    }

    // 4. Criminal / Bail
    if (/(জামিন|গ্রেপ্তার|পুলিশ|থানা|মামলা|জিডি|bail|police|thana|arrest|crime|jail)/i.test(q)) {
      return {
        reply: isEn
          ? "Every undertrial prisoner or accused person has a constitutional right to legal representation. If you or a family member cannot afford a lawyer, the District Legal Aid Officer (DLAO) will appoint a defense lawyer at state expense. Call toll-free 16699 for immediate help."
          : "আটক বিচারাধীন বন্দীদের জামিন আবেদন ও আইনজীবী নিয়োগের জন্য জেলা লিগ্যাল এইড অফিস সম্পূর্ণ সরকারি খরচে আইনজীবী বরাদ্দ করে। ফৌজদারি কার্যবিধি ও লিগ্যাল এইড আইনের অধীনে কোনো ফি দিতে হয় না। জরুরি সহায়তার জন্য ১৬৬৯৯-এ কল করুন।",
        action: { route: '#/apply?emergency=true', label: '⚡ জরুরি জামিন আবেদন' },
        actions: ['apply', 'call', 'offices']
      };
    }

    // 5. Tracking
    if (/(track|ট্র্যাক|অবস্থা|status|kothay|কোথায়)/i.test(q)) {
      return {
        reply: isEn
          ? "You can track your application anytime using your Application ID and the last 4 digits of your phone or NID. No account password is required."
          : "আপনার আবেদন আইডি (যেমন APP-2026-0001 বা DLAS-NET-2026-04417) এবং মোবাইল বা এনআইডির শেষ ৪ ডিজিট দিয়ে যেকোনো সময় রিয়েলটাইম অবস্থা ট্র্যাক করতে পারেন।",
        action: { route: '#/track', label: '📦 ট্র্যাকিং পেজে যান' },
        actions: ['track', 'home']
      };
    }

    // 6. Cost / Free Service
    if (/(free|টাকা|খরচ|ফি|cost|fee|poisa|khoroch)/i.test(q)) {
      return {
        reply: isEn
          ? "All DLAS legal aid services are 100% free of cost funded by the Government of Bangladesh. No citizen has to pay any application fee, lawyer fees, or court fees. If anyone asks for money, report immediately to helpline 16699."
          : "জাতীয় আইনগত সহায়তা প্রদান সংস্থা (NLASO)-র এই সেবা সম্পূর্ণ সরকারি খরচে বিনামূল্যে প্রদান করা হয়। আবেদন ফি, আইনজীবী ফি বা আদালত ফি বাবদ কোনো অর্থ দিতে হয় না। কেউ অর্থ দাবি করলে ১৬৬৯৯-এ অভিযোগ জানান।",
        action: { route: '#/apply', label: '📝 বিনামূল্যে আবেদন করুন' },
        actions: ['apply', 'help', 'offices']
      };
    }

    // Default intelligent response
    return {
      reply: isEn
        ? "I understand your query regarding \"" + esc(raw) + "\". As part of the Bangladesh Digital Legal Aid Portal (DLAS), we provide free consultation, panel lawyers, and dispute mediation (ADR). You can apply online, browse statutory resources, or speak with an officer."
        : "আপনার প্রশ্ন \"" + esc(raw) + "\" সম্পর্কে বিস্তারিত সহায়তা পেতে নিচের সেবাগুলো ব্যবহার করতে পারেন। আপনি সরাসরি সরকারি খরচে আইনি সহায়তার আবেদন করতে পারেন, জেলা অফিস খুঁজে নিতে পারেন অথবা টোল-ফ্রি ১৬৬৯৯ নম্বরে ফোন করতে পারেন।",
      actions: ['apply', 'guide', 'library', 'offices', 'help'],
      quick: ['নতুন আবেদন করুন', 'আবেদন ট্র্যাক করুন', 'নিকটস্থ অফিস খুঁজুন']
    };
  }

  const sendChat = async (override) => {
    const txt = (override != null ? override : chatText.value).trim();
    if (!txt) return;
    if (override == null) chatText.value = '';

    chatBody.insertAdjacentHTML('beforeend', '<div class="msg user">' + esc(txt) + '</div>');
    chatBody.scrollTop = chatBody.scrollHeight;

    const typing = document.createElement('div');
    typing.className = 'msg bot typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    chatBody.appendChild(typing);
    chatBody.scrollTop = chatBody.scrollHeight;

    let res = null;
    try {
      res = await apiPost('chat', { message: txt });
    } catch (e) {
      console.warn('Chat API offline, using local smart search:', e);
    }

    typing.remove();

    if (!res || !res.reply || res.reply.includes('undefined')) {
      res = localSmartSearch(txt);
    }

    const reply = String(res.reply || 'আপনার প্রশ্নটির উত্তর খুঁজে পাওয়া যায়নি। ১৬৬৯৯ হেল্পলাইনে যোগাযোগ করুন।');
    const fmt = esc(reply).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    chatBody.insertAdjacentHTML('beforeend', '<div class="msg bot">' + fmt + '</div>');

    renderActions(res);
    renderQuick(res);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  if (chatForm) {
    chatForm.onsubmit = async (e) => {
      e.preventDefault();
      await sendChat();
    };
  }
}

// ---------- USSD শর্টকোড ফোন সিমুলেটর (*১৬৬৯৯#) ----------
function openUssdSimulator() {
  const existing = $('#ussdSimulatorModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'ussdSimulatorModal';
  modal.className = 'ussd-modal-overlay';

  let currentScreen = 'main';
  let historyText = '*16699# ডায়াল করা হচ্ছে...\n\n১. বাংলা (Bangla)\n২. English\n\nপছন্দ নম্বর লিখে Send চাপুন:';

  const updateScreen = (text, title = 'NLASO USSD · *16699#') => {
    $('#ussdScreenHeader').textContent = title;
    $('#ussdScreenText').textContent = text;
    $('#ussdScreenInput').value = '';
    $('#ussdScreenInput').focus();
  };

  modal.innerHTML = `
    <div class="ussd-phone">
      <button class="ussd-phone-close" id="closeUssd">✕</button>
      <div style="text-align:center;font-size:0.75rem;color:#94A3B8;margin-bottom:8px">জাতীয় আইনি সহায়তা · NLASO</div>
      <div class="ussd-screen">
        <div class="ussd-screen-header" id="ussdScreenHeader">NLASO USSD · *16699#</div>
        <div class="ussd-screen-text" id="ussdScreenText">${historyText}</div>
        <div class="ussd-input-row">
          <input class="ussd-input" id="ussdScreenInput" maxlength="10" placeholder="ইনপুট দিন..." autocomplete="off">
          <button class="btn btn-primary btn-sm" id="btnUssdSend">Send</button>
        </div>
      </div>
      <div class="ussd-keypad">
        <button class="ussd-key" data-k="1">1<sub>&nbsp;</sub></button>
        <button class="ussd-key" data-k="2">2<sub>ABC</sub></button>
        <button class="ussd-key" data-k="3">3<sub>DEF</sub></button>
        <button class="ussd-key" data-k="4">4<sub>GHI</sub></button>
        <button class="ussd-key" data-k="5">5<sub>JKL</sub></button>
        <button class="ussd-key" data-k="6">6<sub>MNO</sub></button>
        <button class="ussd-key" data-k="7">7<sub>PQRS</sub></button>
        <button class="ussd-key" data-k="8">8<sub>TUV</sub></button>
        <button class="ussd-key" data-k="9">9<sub>WXYZ</sub></button>
        <button class="ussd-key" data-k="*">*<sub>+</sub></button>
        <button class="ussd-key" data-k="0">0<sub>_</sub></button>
        <button class="ussd-key" data-k="#">#<sub>#</sub></button>
      </div>
      <div style="text-align:center;margin-top:12px">
        <button class="btn btn-ghost btn-sm" style="color:#94A3B8" id="btnUssdReset">রিসেট ডায়াল</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  $('#closeUssd').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  $$('.ussd-key', modal).forEach(btn => {
    btn.onclick = () => {
      const inp = $('#ussdScreenInput');
      inp.value += btn.dataset.k;
    };
  });

  const handleInput = (val) => {
    val = val.trim();
    if (currentScreen === 'main') {
      if (val === '1' || val === '১') {
        currentScreen = 'menu_bn';
        updateScreen('আইনগত সহায়তা সেবা:\n\n১. নতুন আবেদন দাখিল\n২. আবেদনের অবস্থা যাচাই\n৩. জেলা লিগ্যাল এইড অফিসের তথ্য\n৪. জরুরি হেল্পলাইন কল');
      } else if (val === '2' || val === '২') {
        currentScreen = 'menu_en';
        updateScreen('Legal Aid Services:\n\n1. New Legal Aid Application\n2. Track Application\n3. District Office Information\n4. Direct Helpline Call');
      } else {
        updateScreen('ভুল ইনপুট। অনুগ্রহ করে ১ অথবা ২ চাপুন:\n\n১. বাংলা\n২. English');
      }
    } else if (currentScreen === 'menu_bn') {
      if (val === '১' || val === '1') {
        currentScreen = 'applied';
        const demoAppId = 'APP-2026-' + Math.floor(1000 + Math.random() * 9000);
        updateScreen('ধন্যবাদ! আপনার USSD আবেদন দাখিল সম্পন্ন হয়েছে।\n\nআবেদন আইডি: ' + demoAppId + '\nএসএমএস নিশ্চিতকরণ পাঠানো হয়েছে। ৩ দিনের মধ্যে কর্মকর্তা ফোন করবেন।\n\n০ চাপুন প্রধান মেনুর জন্য।', 'সফল');
      } else if (val === '২' || val === '2') {
        currentScreen = 'track_input';
        updateScreen('আপনার আবেদন আইডির সংখ্যাসমূহ লিখুন (যেমন 20260001):');
      } else if (val === '৩' || val === '3') {
        updateScreen('নিকটস্থ লিগ্যাল এইড অফিস:\n\nজেলা জজ আদালত ভবন, সর্বমোট ৬৪ জেলায় অফিস রয়েছে। সকাল ৯টা থেকে বিকাল ৫টা পর্যন্ত সরাসরি উপস্থিত হয়ে সেবা নিতে পারবেন।\n\n০ চাপুন মেনুর জন্য।');
      } else if (val === '৪' || val === '4') {
        updateScreen('সরাসরি টোল-ফ্রি ১৬৬৯৯ নম্বরে ফোন কল করা হচ্ছে...\n\n(টোল ফ্রি কল চালু রয়েছে)');
      } else if (val === '০' || val === '0') {
        currentScreen = 'main';
        updateScreen('*16699# ডায়াল করা হচ্ছে...\n\n১. বাংলা (Bangla)\n২. English\n\nপছন্দ নম্বর লিখে Send চাপুন:');
      }
    } else if (currentScreen === 'track_input') {
      updateScreen('আবেদন স্ট্যাটাস: চলমান (UNDER REVIEW)\nকেস: পারিবারিক ও দেনমোহর বিরোধ\nকর্মকর্তা পর্যালোচনা করছেন।\n\n০ চাপুন মেনুর জন্য।', 'ট্র্যাকিং তথ্য');
      currentScreen = 'menu_bn';
    } else {
      currentScreen = 'main';
      updateScreen('*16699# ডায়াল করা হচ্ছে...\n\n১. বাংলা (Bangla)\n২. English\n\nপছন্দ নম্বর লিখে Send চাপুন:');
    }
  };

  $('#btnUssdSend').onclick = () => handleInput($('#ussdScreenInput').value);
  $('#ussdScreenInput').onkeydown = (e) => {
    if (e.key === 'Enter') handleInput($('#ussdScreenInput').value);
  };
  $('#btnUssdReset').onclick = () => {
    currentScreen = 'main';
    updateScreen('*16699# ডায়াল করা হচ্ছে...\n\n১. বাংলা (Bangla)\n২. English\n\nপছন্দ নম্বর লিখে Send চাপুন:');
  };
}

window.openUssdSimulator = openUssdSimulator;

// ---------- SPA Router ----------
const routes = [
  { re: /^#?\/?$/, fn: pageHome },
  { re: /^#\/services$/, fn: pageServices },
  { re: /^#\/eligibility$/, fn: pageEligibility },
  { re: /^#\/topics$/, fn: pageTopics },
  { re: /^#\/topic\/([\w-]+)$/, fn: pageTopic },
  { re: /^#\/section\/([\w-]+)$/, fn: pageSection },
  { re: /^#\/form\/([\w-]+)$/, fn: pageForm },
  { re: /^#\/article\/([\w-]+)$/, fn: pageArticle },
  { re: /^#\/guide$/, fn: pageGuide },
  { re: /^#\/search$/, fn: pageSearch },
  { re: /^#\/apply(\?.*)?$/, fn: pageApply },
  { re: /^#\/track(\?.*)?$/, fn: pageTrack },
  { re: /^#\/offices$/, fn: pageOffices },
  { re: /^#\/news$/, fn: pageNews },
  { re: /^#\/news\/([\w-]+)$/, fn: pageNewsDetail },
  { re: /^#\/call$/, fn: pageCall },
  { re: /^#\/help$/, fn: pageHelp },
  { re: /^#\/help\/([\w-]+)$/, fn: pageHelpChannel },
  { re: /^#\/login(\?.*)?$/, fn: pageLogin },
  { re: /^#\/(register|signup)(\?.*)?$/, fn: pageRegister },
  { re: /^#\/dashboard$/, fn: pageDashboard },
  { re: /^#\/console(\?.*)?$/, fn: pageConsole },
  { re: /^#\/complaint$/, fn: pageComplaint }
];

async function route() {
  const hash = location.hash || '#/';
  if (typeof applyI18n === 'function') applyI18n();
  $$('#mainNav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash.split('?')[0]));

  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      try {
        await r.fn(...m.slice(1));
      } catch (e) {
        console.error('Route error:', e);
        app.innerHTML = '<div class="empty-state">' + (window.t ? window.t('errGeneric') : 'সমস্যা হয়েছে — আবার চেষ্টা করুন।') + '</div>';
      }
      window.scrollTo(0, 0);
      return;
    }
  }

  // 404 fallback -> redirect to Home
  pageHome();
}

window.addEventListener('hashchange', route);

// ---------- ১. হোম পেজ ----------
async function pageHome() {
  const isEn = document.documentElement.lang === 'en';

  // Real News & Events items
  const newsItems = (BOOT && BOOT.news && BOOT.news.length) ? BOOT.news.slice(0, 4) : [
    {
      id: 'nw1',
      title: isEn ? 'Pre-case Mandatory Mediation Pilot Successful in Netrokona — Expanding to 8 Districts' : 'নেত্রকোনায় মামলা-পূর্ব বাধ্যতামূলক মধ্যস্থতা পাইলট সফল — ৮ জেলায় সম্প্রসারণ',
      date: isEn ? '15 September 2026' : '১৫ সেপ্টেম্বর ২০২৬',
      tag: isEn ? 'News' : 'নিউজ',
      img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=70',
      desc: isEn ? '72% family and land disputes settled out of court in an 18-month pilot.' : 'নেত্রকোনায় ১৮ মাসের পাইলটে ৭২% পারিবারিক ও ভূমি বিরোধ আদালত ছাড়াই নিষ্পত্তি।'
    },
    {
      id: 'nw2',
      title: isEn ? '16699 Toll-free Helpline Now Serving in Chattogram Dialect' : '১৬৬৯৯ কল সেন্টারে এখন চট্টগ্রামের আঞ্চলিক ভাষাতেও সেবা',
      date: isEn ? '10 September 2026' : '১০ সেপ্টেম্বর ২০২৬',
      tag: isEn ? 'Service' : 'সেবা',
      img: 'https://images.unsplash.com/photo-1516387938699-a93567ec168e?w=800&q=70',
      desc: isEn ? 'Citizens from Mirsarai, Satkania, and surrounding areas can get legal advice in their regional dialect.' : 'মিরসরাই ও সাতকানিয়ার বাসিন্দারা নিজস্ব আঞ্চলিক ভাষায় তাৎক্ষণিক আইনি পরামর্শ পাবেন।'
    },
    {
      id: 'nw3',
      title: isEn ? 'National Legal Aid Day 2026 — Nationwide Free Legal Camps' : 'জাতীয় লিগ্যাল এইড দিবস ২০২৬ — সারাদেশে বিনামূল্যে আইনি ক্যাম্প',
      date: isEn ? '28 September 2026' : '২৮ সেপ্টেম্বর ২০২৬',
      tag: isEn ? 'Event' : 'ইভেন্ট',
      img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=70',
      desc: isEn ? 'Free advice and panel lawyer assignment camps at all 64 District Legal Aid Offices.' : 'প্রতিটি জেলা অফিসে সকাল ৯টা থেকে বিকাল ৫টা পর্যন্ত বিনামূল্যে পরামর্শ ও আইনজীবী নিয়োগ ক্যাম্প।'
    },
    {
      id: 'nw4',
      title: isEn ? 'Over 500,000 Legal Applications Filed via Union Digital Centres' : 'ইউনিয়ন ডিজিটাল সেন্টারের মাধ্যমে আবেদন ৫ লক্ষ ছাড়াল',
      date: isEn ? '05 September 2026' : '৫ সেপ্টেম্বর ২০২৬',
      tag: isEn ? 'Milestone' : 'অর্জন',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=70',
      desc: isEn ? 'Rural citizens applying effortlessly through local UDC entrepreneurs without owning a smartphone.' : '৩০০ ইউনিয়নে ইউডিসি উদ্যোক্তারা সাধারণ নাগরিকদের হয়ে আবেদন দাখিল করে দিচ্ছেন।'
    }
  ];

  app.innerHTML = `
  <!-- হিরো সেকশন -->
  <section class="ref-hero">
    <div class="container ref-hero-inner">
      <h1 class="ref-hero-title">
        ${t('refHeroTitle')}
      </h1>
      <p class="ref-hero-subtitle">
        ${t('refHeroSubtitle')}
      </p>
      <div class="ref-hero-actions">
        <a class="btn-ref-hero-primary" href="#/apply">
          <span>${t('btnNewApp')}</span> <span>→</span>
        </a>
        <a class="btn-ref-hero-outline" href="#/track">
          <span>🔍</span> <span>${t('btnTrackApp')}</span>
        </a>
      </div>
      <div class="hero-demo-chips">
        <span>${t('demoTrackTest')}</span>
        <button type="button" class="chip-ref-demo" id="hDemo1">APP-2026-0001 (ময়ূরী / ৩৩৪৪)</button>
        <button type="button" class="chip-ref-demo" id="hDemo2">DLAS-NET-2026-04420 (৩৩৪৪)</button>
      </div>
    </div>
  </section>

  <!-- সেবাসমূহ সেকশন -->
  <section class="ref-section">
    <div class="container">
      <div class="sec-header-split">
        <div>
          <h2 class="sec-heading-serif">${t('servicesHead')}</h2>
        </div>
        <div>
          <p class="sec-heading-desc">
            ${t('servicesDesc')}
          </p>
        </div>
      </div>

      <div class="ref-services-grid">
        <!-- ১. বিনামূল্যে আইনি পরামর্শ -->
        <div class="ref-svc-card">
          <div class="ref-svc-icon-box icon-box-gold">💬</div>
          <h3>${t('freeConsultTitle')}</h3>
          <p>${t('freeConsultDesc')}</p>
          <a class="ref-svc-link" href="#/guide">
            <span>${t('freeConsultBtn')}</span> <span>→</span>
          </a>
          <div class="ref-svc-bottom-bar bar-gold"></div>
        </div>

        <!-- ২. সরকারি খরচে আইনজীবী নিয়োগ -->
        <div class="ref-svc-card">
          <div class="ref-svc-icon-box icon-box-green">⚖️</div>
          <h3>${t('lawyerAppTitle')}</h3>
          <p>${t('lawyerAppDesc')}</p>
          <a class="ref-svc-link" href="#/apply">
            <span>${t('lawyerAppBtn')}</span> <span>→</span>
          </a>
          <div class="ref-svc-bottom-bar bar-green"></div>
        </div>

        <!-- ৩. বিকল্প বিরোধ নিষ্পত্তি (ADR) -->
        <div class="ref-svc-card">
          <div class="ref-svc-icon-box icon-box-orange">🤝</div>
          <h3>${t('adrServiceTitle')}</h3>
          <p>${t('adrServiceDesc')}</p>
          <a class="ref-svc-link" href="#/apply?purpose=mediation">
            <span>${t('adrServiceBtn')}</span> <span>→</span>
          </a>
          <div class="ref-svc-bottom-bar bar-orange"></div>
        </div>
      </div>
    </div>
  </section>

  <!-- আরও সাহায্য বা আইনজীবীর প্রয়োজন? (Old Web Reference Inspired CTA) -->
  <section class="container">
    <div class="consult-banner">
      <h2>${t('needMoreHelpTitle')}</h2>
      <p>${t('needMoreHelpDesc')}</p>
      <a class="btn-consult" href="#/guide">
        <span>${t('startNow')}</span>
      </a>
    </div>
  </section>

  <!-- নিউজ ও ইভেন্ট সেকশন -->
  <section class="ref-section" style="background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
    <div class="container">
      <div class="sec-header-split">
        <div>
          <span class="section-tag">NLASO আপডেট</span>
          <h2 class="sec-heading-serif">${t('newsEvents')}</h2>
        </div>
        <div>
          <a class="btn btn-outline btn-sm" href="#/news">${t('seeAllNews')}</a>
        </div>
      </div>

      <div class="news-grid">
        ${newsItems.map(item => `
          <a class="news-card" href="#/news/${item.id}">
            <div class="news-card-img-wrap">
              <img class="news-card-img" src="${item.img}" alt="${esc(item.title)}" loading="lazy">
              <span class="news-card-tag">${esc(item.tag || 'নিউজ')}</span>
            </div>
            <div class="news-card-body">
              <div class="news-card-date">
                <span>📅</span> <span>${esc(item.date)}</span>
              </div>
              <h3 class="news-card-title">${esc(item.title)}</h3>
              <p class="news-card-desc">${esc(item.desc || '')}</p>
              <span class="news-card-link">বিস্তারিত পড়ুন →</span>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- সহায়তা চ্যানেল সেকশন (Structured Cards & Buttons) -->
  <section class="ref-section">
    <div class="container">
      <div class="sec-header-split">
        <div>
          <span class="section-tag">প্রবেশগম্যতা</span>
          <h2 class="sec-heading-serif">${t('helpTitle')}</h2>
        </div>
        <div>
          <p class="sec-heading-desc">${t('helpLead')}</p>
        </div>
      </div>

      <div class="channel-grid">
        <div class="channel-card">
          <div class="channel-card-head">
            <div class="channel-icon">📞</div>
            <div>
              <div class="channel-title">${t('hCallT')}</div>
              <small style="color:var(--gov-green);font-weight:700">টোল-ফ্রি ২৪/৭ হেল্পলাইন</small>
            </div>
          </div>
          <p class="channel-desc">${t('hCallB')}</p>
          <a class="channel-btn channel-btn-primary" href="tel:16699">📞 এখনই কল করুন (১৬৬৯৯)</a>
        </div>

        <div class="channel-card">
          <div class="channel-card-head">
            <div class="channel-icon">🏢</div>
            <div>
              <div class="channel-title">${t('hUdcT')}</div>
              <small style="color:var(--text-muted)">নিকটস্থ ইউনিয়ন পরিষদ</small>
            </div>
          </div>
          <p class="channel-desc">${t('hUdcB')}</p>
          <a class="channel-btn channel-btn-outline" href="#/offices">🗺️ উদ্যোক্তা ও অফিস ডিরেক্টরি</a>
        </div>

        <div class="channel-card">
          <div class="channel-card-head">
            <div class="channel-icon">📱</div>
            <div>
              <div class="channel-title">${t('hUssdT')}</div>
              <small style="color:var(--text-muted)">বাটন ফোনে ইন্টারনেট ছাড়া</small>
            </div>
          </div>
          <p class="channel-desc">${t('hUssdB')}</p>
          <button type="button" class="channel-btn channel-btn-outline" id="btnOpenUssd">
            📱 বিস্তারিত দেখুন ও ডায়াল করুন →
          </button>
        </div>

        <div class="channel-card">
          <div class="channel-card-head">
            <div class="channel-icon">🤖</div>
            <div>
              <div class="channel-title">${t('hAiT')}</div>
              <small style="color:var(--text-muted)">স্মার্ট আইনি দিকনির্দেশনা</small>
            </div>
          </div>
          <p class="channel-desc">${t('hAiB')}</p>
          <button type="button" class="channel-btn channel-btn-primary" id="btnOpenAiChat">
            💬 AI সহকারীর সাথে কথা বলুন
          </button>
        </div>
      </div>
    </div>
  </section>
  `;

  // Attach event listeners
  const hDemo1 = $('#hDemo1');
  if (hDemo1) {
    hDemo1.onclick = () => {
      location.hash = '#/track?id=APP-2026-0001&last4=3344';
    };
  }
  const hDemo2 = $('#hDemo2');
  if (hDemo2) {
    hDemo2.onclick = () => {
      location.hash = '#/track?id=DLAS-NET-2026-04420&last4=3344';
    };
  }
  const btnOpenUssd = $('#btnOpenUssd');
  if (btnOpenUssd) {
    btnOpenUssd.onclick = openUssdSimulator;
  }
  const btnOpenAiChat = $('#btnOpenAiChat');
  if (btnOpenAiChat) {
    btnOpenAiChat.onclick = () => {
      if (typeof window.__chatOpen === 'function') window.__chatOpen();
    };
  }
}

// ---------- ২. সেবাসমূহ পেজ ----------
async function pageServices() {
  app.innerHTML = `
  <div class="container page-head">
    <span class="section-tag">সরকারি আইনি সেবা</span>
    <h1>⚖️ ${t('servicesTitle') || 'আমাদের আইনি সেবাসমূহ'}</h1>
    <p>${t('servicesSubtitle') || 'লিগ্যাল এইড অফিস থেকে আপনি যেসব সেবা সম্পূর্ণ বিনামূল্যে পেতে পারেন'}</p>
  </div>
  <div class="container">
    <div class="services-top3-grid">
      <!-- ১. বিনামূল্যে আইনি পরামর্শ -->
      <div class="svc-top-card">
        <div class="svc-top-header">
          <div class="ref-svc-icon-badge icon-box-gold">💬</div>
          <div>
            <span class="svc-top-badge badge-gold">পরামর্শ</span>
            <h3>${t('freeConsultTitle') || 'বিনামূল্যে আইনি পরামর্শ'}</h3>
          </div>
        </div>
        <p>${t('freeConsultDesc') || 'পারিবারিক, জমিজমা, যৌতুক বা ফৌজদারি বিষয়ে টোল-ফ্রি ১৬৬৯৯ হেল্পলাইন ও এআই গাইডের মাধ্যমে তাত্ক্ষণিক আইনি পরামর্শ।'}</p>
        <a class="svc-btn-action svc-btn-outline" href="#/guide">সরাসরি আইনি পরামর্শ নিন</a>
      </div>

      <!-- ২. সরকারি খরচে আইনজীবী নিয়োগ -->
      <div class="svc-top-card">
        <div class="svc-top-header">
          <div class="ref-svc-icon-badge icon-box-green">⚖️</div>
          <div>
            <span class="svc-top-badge badge-green">আইনজীবী নিয়োগ</span>
            <h3>${t('lawyerAppTitle') || 'সরকারি খরচে আইনজীবী নিয়োগ'}</h3>
          </div>
        </div>
        <p>${t('lawyerAppDesc') || 'আদালতে মামলা পরিচালনা ও জামিনের জন্য অসচ্ছল নাগরিকদের সম্পূর্ণ রাষ্ট্রীয় খরচে অভিজ্ঞ আইনজীবী প্রদান।'}</p>
        <a class="svc-btn-action svc-btn-solid" href="#/apply">আইনজীবী পেতে আবেদন করুন</a>
      </div>

      <!-- ৩. বিকল্প বিরোধ নিষ্পত্তি (ADR) -->
      <div class="svc-top-card">
        <div class="svc-top-header">
          <div class="ref-svc-icon-badge icon-box-orange">🤝</div>
          <div>
            <span class="svc-top-badge badge-orange">ADR</span>
            <h3>${t('adrServiceTitle') || 'বিকল্প বিরোধ নিষ্পত্তি (ADR)'}</h3>
          </div>
        </div>
        <p>${t('adrServiceDesc') || 'মামলা-মোকদ্দমা ছাড়াই আপস-মীমাংসার মাধ্যমে পারিবারিক ও দেওয়ানি বিরোধের দ্রুত ও স্থায়ী সমাধান।'}</p>
        <a class="svc-btn-action svc-btn-outline" href="#/apply?purpose=mediation">ADR এর জন্য আবেদন করুন</a>
      </div>
    </div>
  </div>`;
}

// ---------- ৩. বিনামূল্যে আইনি পরামর্শ ও গাইড (pageGuide) ----------
async function pageGuide() {
  const categories = (BOOT && BOOT.categories) || [
    { id: 'family', title: 'পারিবারিক ও দাম্পত্য' },
    { id: 'land', title: 'জমি-জমা ও সম্পত্তি' },
    { id: 'safety', title: 'নিরাপত্তা ও সহিংসতা' },
    { id: 'money', title: 'অর্থ ও চেক সংক্রান্ত' },
    { id: 'labour', title: 'শ্রমিক ও মজুরি অধিকার' },
    { id: 'crime', title: 'ফৌজদারি ও জামিন' }
  ];

  let step = 1;
  let selectedCategory = 'family';
  let selectedNeed = 'advice';

  function render() {
    app.innerHTML = `
    <div class="container page-head">
      <span class="section-tag">বিনামূল্যে আইনি পরামর্শ</span>
      <h1>🧭 ${t('guideTitle')}</h1>
      <p>${t('guideLead')}</p>
    </div>
    <div class="container">
      <div class="form-card" style="max-width:740px">
        ${step === 1 ? `
          <h3>১. আপনার সমস্যার ক্ষেত্রটি বেছে নিন:</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin:1.2rem 0">
            ${categories.map(c => `
              <button type="button" class="btn btn-outline guide-cat-btn ${selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}" style="${selectedCategory === c.id ? 'background:var(--gov-green-surface);border-color:var(--gov-green);font-weight:700' : ''}">
                ${esc(c.title)}
              </button>
            `).join('')}
          </div>
          <div class="wizard-actions">
            <button class="btn btn-primary" id="gNext1">${t('guideNext')} →</button>
          </div>
        ` : step === 2 ? `
          <h3>২. আপনার প্রধান উদ্দেশ্য কী?</h3>
          <div style="display:flex;flex-direction:column;gap:10px;margin:1.2rem 0">
            <label class="check-line" style="background:var(--surface-2);padding:10px;border-radius:8px">
              <input type="radio" name="gNeed" value="advice" ${selectedNeed === 'advice' ? 'checked' : ''}>
              <span><strong>শুধু বিনামূল্যে আইনি পরামর্শ ও দিকনির্দেশনা চাই</strong> (মামলা করার আগে করণীয় জানুন)</span>
            </label>
            <label class="check-line" style="background:var(--surface-2);padding:10px;border-radius:8px">
              <input type="radio" name="gNeed" value="mediation" ${selectedNeed === 'mediation' ? 'checked' : ''}>
              <span><strong>আদালতের বাইরে আপস-মীমাংসা (ADR / মধ্যস্থতা) চাই</strong> (বিনা খরচে দ্রুত সমাধান)</span>
            </label>
            <label class="check-line" style="background:var(--surface-2);padding:10px;border-radius:8px">
              <input type="radio" name="gNeed" value="lawyer" ${selectedNeed === 'lawyer' ? 'checked' : ''}>
              <span><strong>সরকারি খরচে প্যানেল আইনজীবী নিয়োগ চাই</strong> (আদালতে মোকদ্দমা পরিচালনার জন্য)</span>
            </label>
          </div>
          <div class="wizard-actions">
            <button class="btn btn-ghost" id="gBack2">← ${t('guideBack')}</button>
            <button class="btn btn-primary" id="gNext2">${t('guideNext')} →</button>
          </div>
        ` : `
          <div style="background:var(--gov-green-surface);border:1.5px solid #A7F3D0;border-radius:var(--radius);padding:1.4rem;margin-bottom:1.5rem">
            <h3 style="color:var(--gov-green-dark);margin-bottom:.6rem">🎯 ${t('guideResult')}</h3>
            <p style="font-size:0.95rem;line-height:1.6">
              আপনার নির্বাচিত বিষয়ের ক্ষেত্রে <strong>আইনগত সহায়তা প্রদান আইন ২০০০</strong>-এর অধীনে সম্পূর্ণ সরকারি খরচে আপনি আইনি প্রতিকার পাওয়ার অধিকারী।
            </p>
            <div style="margin-top:12px;padding:10px;background:#FFF;border-radius:8px;font-size:0.88rem">
              🔒 <strong>আইনি নিশ্চয়তা:</strong> আপনার ব্যক্তিগত তথ্য "ব্যক্তিগত উপাত্ত সুরক্ষা আইন, ২০২৬ (২০২৬ সনের ৬৩ নং আইন)" অনুযায়ী সংরক্ষিত থাকে। কোনো ফি দিতে হয় না।
            </div>
          </div>
          <div class="wizard-actions" style="flex-wrap:wrap">
            <a class="btn btn-primary" href="#/apply?category=${selectedCategory}&purpose=${selectedNeed}">📝 এখনই আবেদন দাখিল করুন</a>
            <a class="btn btn-outline" href="tel:16699">📞 কল করুন ১৬৬৯৯ (টোল-ফ্রি)</a>
            <button class="btn btn-ghost" id="gRestart">🔄 আবার শুরু করুন</button>
          </div>
        `}
      </div>
    </div>`;

    if (step === 1) {
      $$('.guide-cat-btn').forEach(btn => {
        btn.onclick = () => {
          selectedCategory = btn.dataset.cat;
          render();
        };
      });
      $('#gNext1').onclick = () => { step = 2; render(); };
    } else if (step === 2) {
      $$('input[name="gNeed"]').forEach(r => {
        r.onchange = () => { selectedNeed = r.value; };
      });
      $('#gBack2').onclick = () => { step = 1; render(); };
      $('#gNext2').onclick = () => { step = 3; render(); };
    } else if (step === 3) {
      $('#gRestart').onclick = () => { step = 1; render(); };
    }
  }

  render();
}

// ---------- ৪. সেলফ-হেল্প রিসোর্স লাইব্রেরি (pageTopics & pageTopic & pageSection) ----------
async function pageTopics() {
  app.innerHTML = `
  <div class="container page-head">
    <h1>📚 ${t('libraryTitle')}</h1>
    <p>${t('libraryBody')}</p>
    <div class="search-bar" style="margin-top:1rem;max-width:100%">
      <input id="topicQ" placeholder="${t('searchPh') || 'আইনি বিষয় বা কিওয়ার্ড লিখুন...'}">
    </div>
  </div>
  <div class="container">
    <div class="topic-grid" id="topicGrid"></div>
  </div>`;

  const render = (q = '') => {
    const cats = (BOOT.categories || []).filter((c) => !q || (c.title + ' ' + (c.desc || '')).toLowerCase().includes(q.toLowerCase()));
    $('#topicGrid').innerHTML = cats.map((c) => {
      const count = (BOOT.articles || []).filter((a) => a.topic === c.id).length;
      return `
        <a class="topic-card" href="#/topic/${c.id}">
          <span class="topic-icon">${c.icon || '⚖️'}</span>
          <span>
            <h3>${esc(c.title)}</h3>
            <p>${esc(c.desc || '')}</p>
            <small style="color:var(--brand);font-weight:600">${bnNum(count || 6)}টি আর্টিকেল ও ফরম</small>
          </span>
        </a>
      `;
    }).join('') || '<div class="empty-state">কোনো আইনি তথ্য পাওয়া যায়নি।</div>';
  };

  render();
  $('#topicQ').oninput = (e) => render(e.target.value);
}

async function pageTopic(id) {
  const cat = (BOOT.categories || []).find((c) => c.id === id);
  if (!cat) return pageTopics();
  const sections = (BOOT.sections && BOOT.sections[id]) || [];

  app.innerHTML = `
  <div class="container page-head">
    <div class="breadcrumb"><a href="#/topics">${t('navLibrary')}</a> / ${esc(cat.title)}</div>
    <h1><span class="topic-icon" style="display:inline-flex;vertical-align:middle;margin-right:.5rem">${cat.icon || '⚖️'}</span>${esc(cat.title)}</h1>
    <p>${esc(cat.desc || '')}</p>
  </div>
  <div class="container">
    <div class="subtopic-grid">
      ${sections.map((s) => `
        <a class="subtopic-card" href="${s.kind === 'form' ? '#/form/' + s.formId : '#/section/' + s.id}">
          <span class="subtopic-card-icon">${s.icon || (s.kind === 'form' ? '📄' : '📁')}</span>
          <h3 class="subtopic-card-title">${esc(s.title)}</h3>
          ${s.desc ? `<p class="subtopic-card-desc">${esc(s.desc)}</p>` : ''}
          <div class="subtopic-card-footer">
            <span>${s.kind === 'form' ? 'ফরম পূরণ' : 'উপ-বিষয় ও গাইড'}</span>
            <span>বিস্তারিত দেখুন →</span>
          </div>
        </a>
      `).join('')}
    </div>
  </div>`;
}

// Subtopic / Last Tree Grid (Issue 8: Rounded Box Cards)
async function pageSection(id) {
  let section = null, parentCat = null;
  for (const [catId, secs] of Object.entries(BOOT.sections || {})) {
    const hit = secs.find((s) => s.id === id);
    if (hit) {
      section = hit;
      parentCat = (BOOT.categories || []).find((c) => c.id === catId);
      break;
    }
  }
  if (!section) return pageTopics();

  app.innerHTML = `
  <div class="container page-head">
    <div class="breadcrumb">
      <a href="#/topics">${t('navLibrary')}</a> /
      ${parentCat ? `<a href="#/topic/${parentCat.id}">${esc(parentCat.title)}</a> /` : ''}
      ${esc(section.title)}
    </div>
    <h1>${section.icon || '📁'} ${esc(section.title)}</h1>
    <p>${esc(section.desc || 'বিষয়ভিত্তিক নির্দেশিকা ও ফরমসমূহ:')}</p>
  </div>
  <div class="container">
    <div class="subtopic-grid">
      ${(section.children || []).map((ch) => {
        if (ch.kind === 'form') {
          return `
            <a class="subtopic-card" href="#/form/${ch.formId}">
              <span class="subtopic-card-icon">📄</span>
              <h3 class="subtopic-card-title">${esc(ch.title)}</h3>
              <p class="subtopic-card-desc">অনলাইনে তথ্য পূরণ করে প্রিন্টযোগ্য ফরম বা আবেদন প্রস্তুত করুন।</p>
              <div class="subtopic-card-footer">
                <span class="badge info">ফরম</span>
                <span>পূরণ করুন →</span>
              </div>
            </a>
          `;
        }
        const a = (BOOT.articles || []).find((x) => x.id === ch.id);
        return `
          <a class="subtopic-card" href="#/article/${ch.id}">
            <span class="subtopic-card-icon">📖</span>
            <h3 class="subtopic-card-title">${esc(ch.title)}</h3>
            <p class="subtopic-card-desc">${a ? esc(a.summary) : 'আইনগত অধিকার ও ধাপসমূহ।'}</p>
            <div class="subtopic-card-footer">
              <span>⏱️ ${a ? esc(a.read) : '৪ মিনিট'}</span>
              <span>পড়ুন →</span>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  </div>`;
}

// ---------- ৫. আবেদন ট্র্যাক করুন (pageTrack) ----------
async function pageTrack(queryStr) {
  const hash = (typeof queryStr === 'string' && queryStr) ? queryStr : (location.hash || '');
  const searchParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : (hash.startsWith('?') ? hash.slice(1) : ''));
  const initialId = searchParams.get('id') || searchParams.get('appId') || '';
  const initialLast4 = searchParams.get('last4') || '';

  app.innerHTML = `
  <div class="container page-head">
    <span class="section-tag">রিয়েলটাইম অনুসন্ধান</span>
    <h1>📦 ${t('trackTitle')}</h1>
    <p>${t('trackLead')}</p>
  </div>
  <div class="container">
    <div class="form-card" style="max-width:720px">
      <div id="trackErr" class="form-error hidden"></div>
      
      <div class="field">
        <label>${t('appId')} <span class="req">*</span></label>
        <input id="t_id" value="${esc(initialId)}" placeholder="যেমন: APP-2026-0001 বা DLAS-NET-2026-04417" autocomplete="off">
        <div class="hint">${t('appIdHint')}</div>
      </div>
      
      <div class="field" style="margin-top:1.1rem">
        <label>${t('last4')} <span class="req">*</span></label>
        <input id="t_last4" value="${esc(initialLast4)}" maxlength="4" inputmode="numeric" placeholder="যেমন: 3344" autocomplete="off">
        <div class="hint">নিরাপত্তা যাচাইকরণ: নিবন্ধিত ফোন নম্বর বা জাতীয় পরিচয়পত্রের শেষ ৪ অঙ্ক</div>
      </div>

      <div style="margin-top:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:0.84rem;color:var(--text-muted)">
        <span>ডেমো রেকর্ড:</span>
        <button type="button" class="chip-demo" id="t_demo1" data-id="APP-2026-0001" data-last4="3344">APP-2026-0001 (ময়ূরী / ৩৩৪৪)</button>
        <button type="button" class="chip-demo" id="t_demo2" data-id="DLAS-NET-2026-04420" data-last4="3344">DLAS-NET-2026-04420 (৩৩৪৪)</button>
      </div>

      <div class="wizard-actions">
        <button class="btn btn-ghost" id="t_clear">${t('clear')}</button>
        <button class="btn btn-primary" id="t_go">
          <span>🔍</span> <span>${t('lookup')}</span>
        </button>
      </div>

      <div id="trackResult"></div>
    </div>
  </div>`;

  $('#t_clear').onclick = () => {
    $('#t_id').value = '';
    $('#t_last4').value = '';
    $('#trackResult').innerHTML = '';
    $('#trackErr').classList.add('hidden');
  };

  const doTrack = async () => {
    const err = $('#trackErr');
    const resultBox = $('#trackResult');
    err.classList.add('hidden');
    resultBox.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">অনুসন্ধান করা হচ্ছে…</div>';

    const appId = ($('#t_id').value || '').trim();
    const last4 = ($('#t_last4').value || '').trim();

    if (!appId || !last4) {
      err.textContent = 'অনুগ্রহ করে আবেদন আইডি ও শেষ ৪ ডিজিট উভয়ই পূরণ করুন।';
      err.classList.remove('hidden');
      resultBox.innerHTML = '';
      return;
    }

    const r = await apiPost('track', { appId, last4 });
    if (r.error) {
      err.textContent = r.error;
      err.classList.remove('hidden');
      resultBox.innerHTML = '';
      return;
    }

    resultBox.innerHTML = `
      <div style="background:var(--surface-2);border-radius:var(--radius-lg);padding:1.4rem;margin-top:1.5rem;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <div>
            <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600">আবেদন নম্বর</span>
            <div style="font-size:1.35rem;font-weight:800;color:var(--gov-green);font-family:monospace">${esc(r.appId)}</div>
            ${r.caseId ? `<div style="font-size:0.88rem;color:var(--gov-gold);font-weight:700">কেস নম্বর: ${esc(r.caseId)}</div>` : ''}
          </div>
          <div style="text-align:right">
            <span class="badge success" style="font-size:0.85rem">ধাপ ${bnNum(r.stage + 1)}: ${esc(r.stageLabel)}</span>
            ${r.emergency ? '<div style="margin-top:4px"><span class="badge warn">জরুরি অগ্রাধিকার</span></div>' : ''}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-bottom:12px;font-size:0.88rem">
          <div><strong>আবেদনকারী:</strong> ${esc(r.applicantName || 'নাগরিক')}</div>
          <div><strong>অফিস:</strong> ${esc(r.office || 'জেলা লিগ্যাল এইড অফিস')}</div>
          <div><strong>মামলার ধরন:</strong> ${esc(r.caseType || 'সাধারণ')}</div>
          <div><strong>দাখিল তারিখ:</strong> ${esc(r.submitted ? new Date(r.submitted).toLocaleDateString('bn-BD') : '—')}</div>
        </div>

        ${r.nextStep ? `
          <div class="quick-ans" style="margin:10px 0;background:var(--surface);border-color:var(--gov-green)">
            🎯 <strong>পরবর্তী পদক্ষেপ:</strong> ${esc(r.nextStep)}
          </div>
        ` : ''}

        ${(r.headsUp && r.headsUp.length) ? `
          <div class="quick-ans" style="margin:10px 0;background:var(--surface);border-color:var(--gov-gold)">
            🔔 <strong>গুরুত্বপূর্ণ নির্দেশনা:</strong>
            <ul style="margin:6px 0 0 18px;font-size:0.88rem">
              ${r.headsUp.map(h => `<li>${esc(h)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <h4 style="margin:1.4rem 0 0.8rem;font-size:1rem">প্রক্রিয়ার অগ্রগতি টাইমলাইন:</h4>
        <ul class="timeline">
          ${(r.stages || []).map((s, i) => `
            <li class="${s.done ? 'done' : ''} ${s.current ? 'current' : ''}">
              <div class="tl-dot">${s.done ? '✓' : bnNum(i + 1)}</div>
              <div class="tl-body">
                <strong>${esc(s.label)}</strong>
                ${s.current ? `<span>${t('currentStage')}</span>` : ''}
              </div>
            </li>
          `).join('')}
        </ul>

        <p style="color:var(--text-muted);font-size:0.84rem;margin-top:14px;border-top:1px solid var(--border);padding-top:10px">
          ℹ️ ${esc(r.note || 'সম্পূর্ণ বিবরণের জন্য নিকটবর্তী লিগ্যাল এইড অফিসে যোগাযোগ করুন অথবা টোল-ফ্রি ১৬৬৯৯-এ কল করুন।')}
        </p>
      </div>
    `;
  };

  $('#t_go').onclick = doTrack;

  $('#t_demo1').onclick = () => {
    $('#t_id').value = 'APP-2026-0001';
    $('#t_last4').value = '3344';
    doTrack();
  };

  $('#t_demo2').onclick = () => {
    $('#t_id').value = 'DLAS-NET-2026-04420';
    $('#t_last4').value = '3344';
    doTrack();
  };

  if (initialId && initialLast4) {
    doTrack();
  }
}

// ---------- ৬. নতুন আবেদন দাখিল (pageApply) — Universal Form Covering All 18 Topics ----------
async function pageApply(queryStr) {
  const hash = (typeof queryStr === 'string' && queryStr) ? queryStr : (location.hash || '');
  const searchParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : (hash.startsWith('?') ? hash.slice(1) : ''));
  const prePurpose = searchParams.get('purpose') || 'new';
  const preCat = searchParams.get('category') || '';
  const isEmergency = searchParams.get('emergency') === 'true';

  // Comprehensive list of all 18 topics matching the Resource Library
  const allCategories = (BOOT && BOOT.categories) || [
    { id: 'family', title: 'পারিবারিক ও দেনমোহর বিরোধ' },
    { id: 'safety', title: 'নিরাপত্তা ও পারিবারিক সহিংসতা' },
    { id: 'land', title: 'বাসস্থান, জমি ও সম্পত্তি বিরোধ' },
    { id: 'money', title: 'অর্থ, ঋণ, দেনা ও প্রতারণা' },
    { id: 'crime', title: 'ফৌজদারি ও কারাবন্দী জামিন সহায়তা' },
    { id: 'labour', title: 'শ্রম, মজুরি ও চাকরি অধিকার' },
    { id: 'identity', title: 'পরিচয়পত্র, এনআইডি ও জন্ম নিবন্ধন' },
    { id: 'wills', title: 'উত্তরাধিকার সম্পত্তি ও ফারায়েজ' },
    { id: 'cyber', title: 'ডিজিটাল অপরাধ ও সাইবার হয়রানি' },
    { id: 'govt', title: 'সরকারি সহায়তা ও সামাজিক ভাতা' },
    { id: 'tax', title: 'আয়কর, ভ্যাট ও রাজস্ব' },
    { id: 'education', title: 'শিক্ষা ও ছাত্র অধিকার' },
    { id: 'farm', title: 'কৃষি ও মৎস্য শ্রমিক অধিকার' },
    { id: 'rights', title: 'ভোটাধিকার ও তথ্য অধিকার (RTI)' },
    { id: 'immigration', title: 'প্রবাসী শ্রমিক ও অভিবাসন' },
    { id: 'court', title: 'আদালতের কার্যপ্রণালী ও নকল' },
    { id: 'efiling', title: 'ই-ফাইলিং ও ডিজিটাল সেবা' },
    { id: 'health', title: 'স্বাস্থ্য ও পরিবেশ দূষণ' }
  ];

  const allDistricts = [...new Set(((BOOT && BOOT.offices) || []).map((o) => o.district))];
  if (!allDistricts.length) {
    allDistricts.push('ঢাকা', 'জয়পুরহাট', 'চট্টগ্রাম', 'রাজশাহী', 'খুলনা', 'বরিশাল', 'সিলেট', 'রংপুর', 'ময়মনসিংহ', 'ঝিনাইদহ');
  }

  const state = {
    step: 1,
    data: {
      caseType: preCat || 'family',
      purpose: prePurpose,
      emergency: isEmergency,
      idType: 'nid' // 'nid', 'birth_cert', 'none'
    }
  };

  render();

  function render() {
    const steps = ['সমস্যা', 'পরিচয়', 'যোগাযোগ', 'আর্থ-সামাজিক', 'প্রতিপক্ষ', 'যাচাই ও জমা'];
    app.innerHTML = `
    <div class="container page-head">
      <span class="section-tag">সরকারি আইনি সহায়তা</span>
      <h1>📝 ${t('applyTitle')}</h1>
      <p>${t('applyLead')}</p>
    </div>
    <div class="container">
      <div class="form-card" style="max-width:740px">
        <div class="wizard-steps">
          ${steps.map((s, i) => `
            <div class="wstep ${i + 1 === state.step ? 'active' : i + 1 < state.step ? 'done' : ''}">
              ${bnNum(i + 1)}. ${s}
            </div>
          `).join('')}
        </div>
        <div id="stepBody"></div>
        <div class="wizard-actions">
          <button class="btn btn-ghost" id="aPrev" ${state.step === 1 ? 'style="visibility:hidden"' : ''}>← ${t('guideBack')}</button>
          <button class="btn btn-primary" id="aNext">
            ${state.step === 6 ? '✓ জমা দিন' : t('guideNext') + ' →'}
          </button>
        </div>
      </div>
    </div>`;

    renderStep();

    $('#aPrev').onclick = () => {
      if (state.step > 1) { state.step--; render(); }
    };
    $('#aNext').onclick = () => {
      if (!collect()) return;
      if (state.step < 6) { state.step++; render(); }
      else submit();
    };
  }

  function stepHtml(inner) { $('#stepBody').innerHTML = inner; }

  function renderStep() {
    const d = state.data;
    if (state.step === 1) {
      stepHtml(`
        <div class="field">
          <label>আপনার আইনি সমস্যার বিষয় নির্বাচন করুন <span class="req">*</span></label>
          <select id="f_caseType">
            ${allCategories.map(c => `
              <option value="${c.id}" ${d.caseType === c.id ? 'selected' : ''}>${esc(c.title)}</option>
            `).join('')}
          </select>
          <div class="hint">রিসোর্স লাইব্রেরির সকল ১৮টি ক্ষেত্রই এই একক ফরমে অন্তর্ভুক্ত।</div>
        </div>

        <div class="field" style="margin-top:1rem">
          <label>আপনার কাঙ্ক্ষিত প্রতিকার / উদ্দেশ্য</label>
          <select id="f_purpose">
            <option value="new" ${d.purpose === 'new' ? 'selected' : ''}>নতুন আইনি সমস্যার প্রতিকার</option>
            <option value="mediation" ${d.purpose === 'mediation' ? 'selected' : ''}>বিকল্প বিরোধ নিষ্পত্তি (ADR / মধ্যস্থতা)</option>
            <option value="lawyer" ${d.purpose === 'lawyer' ? 'selected' : ''}>সরকারি খরচে আইনজীবী ও আদালত সহায়তা</option>
            <option value="advice" ${d.purpose === 'advice' ? 'selected' : ''}>বিনামূল্যে আইনি পরামর্শ</option>
          </select>
        </div>

        <div class="field" style="margin-top:1rem">
          <label>জেলা <span class="req">*</span></label>
          <select id="f_district">
            ${allDistricts.map(x => `<option ${d.district === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
          </select>
        </div>

        <div class="field" style="margin-top:1rem">
          <label>সমস্যার বিস্তারিত বিবরণ <span class="req">*</span></label>
          <textarea id="f_problem" placeholder="কী ঘটেছে, কবে থেকে শুরু, প্রতিপক্ষ কে — সংক্ষেপে সহজ ভাষায় লিখুন...">${esc(d.problem || '')}</textarea>
        </div>

        <label class="check-line" style="margin-top:.8rem">
          <input type="checkbox" id="f_emergency" ${d.emergency ? 'checked' : ''}>
          <span>জরুরি আইনি সহায়তা প্রয়োজন (আটক/গ্রেপ্তার/উচ্ছেদ/তাত্ক্ষণিক হুমকি)</span>
        </label>
        <label class="check-line">
          <input type="checkbox" id="f_sensitive" ${d.sensitive ? 'checked' : ''}>
          <span>এটি স্পর্শকাতর অভিযোগ (পারিবারিক সহিংসতা/নির্যাতন) — সর্বোচ্চ গোপনীয়তা নিশ্চিত রাখুন</span>
        </label>
      `);
    } else if (state.step === 2) {
      stepHtml(`
        <div class="field">
          <label>আবেদনকারীর পুরো নাম <span class="req">*</span></label>
          <input id="f_name" value="${esc(d.name || '')}" placeholder="জাতীয় পরিচয়পত্র বা জন্মনিবন্ধন অনুযায়ী নাম">
        </div>

        <div class="form-grid" style="margin-top:.9rem">
          <div class="field">
            <label>লিঙ্গ</label>
            <select id="f_gender">
              <option ${d.gender === 'নারী' ? 'selected' : ''}>নারী</option>
              <option ${d.gender === 'পুরুষ' ? 'selected' : ''}>পুরুষ</option>
              <option ${d.gender === 'অন্যান্য' ? 'selected' : ''}>অন্যান্য</option>
            </select>
          </div>
          <div class="field">
            <label>বয়স</label>
            <input id="f_age" type="number" min="0" value="${esc(d.age || '')}" placeholder="যেমন: ৩৪">
          </div>
        </div>

        <!-- পরিচয়পত্রের ধরন (NID / জন্ম নিবন্ধন / কোনোটিই নেই) (PDF 2 কেইস এ১ Requirement) -->
        <div class="field" style="margin-top:1rem">
          <label>পরিচয়পত্র নির্ধারণ করুন</label>
          <select id="f_idType">
            <option value="nid" ${d.idType === 'nid' ? 'selected' : ''}>জাতীয় পরিচয়পত্র (NID)</option>
            <option value="birth_cert" ${d.idType === 'birth_cert' ? 'selected' : ''}>জন্ম নিবন্ধন সনদ (Birth Certificate)</option>
            <option value="none" ${d.idType === 'none' ? 'selected' : ''}>পরিচয়পত্র নেই (এখন উপলব্ধ নয়)</option>
          </select>
          <div class="hint">ময়ূরী বা সুবিধাবঞ্চিত নাগরিকের এনআইডি না থাকলে জন্ম নিবন্ধন বা পরিচয়পত্রহীন অবস্থায় আবেদন দাখিল সম্ভব।</div>
        </div>

        <div class="field ${d.idType === 'none' ? 'hidden' : ''}" id="idNumberWrap" style="margin-top:.8rem">
          <label id="idNumberLabel">${d.idType === 'birth_cert' ? 'জন্ম নিবন্ধন সনদ নম্বর' : 'জাতীয় পরিচয়পত্র (NID) নম্বর'}</label>
          <input id="f_nid" value="${esc(d.nid || '')}" placeholder="১০/১৩/১৭ ডিজিট">
        </div>

        <!-- প্রতিনিধি হিসেবে আবেদন (Ripon on behalf of Moyuri) -->
        <div style="background:var(--surface-2);padding:1rem;border-radius:10px;margin-top:1.2rem;border:1px dashed var(--border)">
          <label class="check-line">
            <input type="checkbox" id="f_isRep" ${d.isRep ? 'checked' : ''}>
            <span><strong>অন্যের পক্ষে (প্রতিনিধি হিসেবে) আবেদন করছেন?</strong> (যেমন আত্মীয়, প্রতিবেশী, সমাজকর্মী)</span>
          </label>
          <div id="repFields" class="${d.isRep ? '' : 'hidden'}" style="margin-top:10px">
            <div class="field">
              <label>প্রতিনিধির নাম</label>
              <input id="f_repName" value="${esc(d.repName || '')}" placeholder="আপনার নিজের নাম">
            </div>
            <div class="form-grid" style="margin-top:.8rem">
              <div class="field">
                <label>প্রতিনিধির মোবাইল নম্বর</label>
                <input id="f_repPhone" value="${esc(d.repPhone || '')}" placeholder="01XXXXXXXXX">
              </div>
              <div class="field">
                <label>আবেদনকারীর সাথে সম্পর্ক</label>
                <input id="f_repRelation" value="${esc(d.repRelation || '')}" placeholder="যেমন: ভাই, প্রতিবেশি, ইত্যাদি">
              </div>
            </div>
            <div class="hint">সংশ্লিষ্ট কর্মকর্তা প্রতিনিধির নম্বরে ফলোআপ কল দিয়ে বিস্তারিত যাচাই করবেন।</div>
          </div>
        </div>
      `);

      $('#f_idType').onchange = (e) => {
        d.idType = e.target.value;
        const wrap = $('#idNumberWrap');
        const lbl = $('#idNumberLabel');
        if (d.idType === 'none') {
          wrap.classList.add('hidden');
          d.nid = '';
        } else {
          wrap.classList.remove('hidden');
          lbl.textContent = d.idType === 'birth_cert' ? 'জন্ম নিবন্ধন সনদ নম্বর' : 'জাতীয় পরিচয়পত্র (NID) নম্বর';
        }
      };

      $('#f_isRep').onchange = (e) => {
        d.isRep = e.target.checked;
        $('#repFields').classList.toggle('hidden', !d.isRep);
      };
    } else if (state.step === 3) {
      stepHtml(`
        <div class="field">
          <label>আবেদনকারীর মোবাইল নম্বর <span class="req">*</span></label>
          <input id="f_phone" value="${esc(d.phone || '')}" placeholder="01XXXXXXXXX">
          <div class="hint">এই নম্বরেই আবেদন ট্র্যাকিং আইডি ও এসএমএস আপডেট পাঠানো হবে।</div>
        </div>

        <!-- ব্যক্তিগত নাকি শেয়ার্ড ফোন & নিরাপদ যোগাযোগের সময় (PDF 2 Requirement) -->
        <div class="form-grid" style="margin-top:.9rem">
          <div class="field">
            <label>ফোনটির প্রকৃতি</label>
            <select id="f_phoneType">
              <option value="personal" ${d.phoneType === 'personal' ? 'selected' : ''}>ব্যক্তিগত ফোন (শুধুমাত্র আবেদনকারী ধরেন)</option>
              <option value="shared" ${d.phoneType === 'shared' ? 'selected' : ''}>শেয়ার্ড ফোন (পরিবারের অন্য সদস্যও ধরতে পারেন)</option>
            </select>
          </div>
          <div class="field">
            <label>নিরাপদ যোগাযোগের সময়সূচি</label>
            <input id="f_window" value="${esc(d.window || '')}" placeholder="যেমন: সকাল ১০টা–১২টা, দুপুর ২টা–৪টা">
          </div>
        </div>

        <div class="field" style="margin-top:.9rem">
          <label>বিকল্প নিরাপদ ফোন নম্বর (যদি থাকে)</label>
          <input id="f_safe" value="${esc(d.safeNumber || '')}" placeholder="জরুরি অবস্থায় যোগাযোগের বিকল্প নিরাপদ নম্বর">
        </div>

        <div class="quick-ans" style="margin-top:1rem;background:var(--gov-green-surface);border-color:#A7F3D0">
          🛡️ <strong>নিরাপদ যোগাযোগ সতর্কতা (Neutral Wording Policy):</strong>
          কল করার সময় যদি অন্য কেউ ফোন রিসিভ করে, লিগ্যাল এইডের সংবেদনশীল বা গোপনীয় তথ্য প্রকাশ না করে সাধারণ সরকারি বার্তা হিসেবে কথা বলা হবে।
        </div>
      `);
    } else if (state.step === 4) {
      stepHtml(`
        <div class="form-grid">
          <div class="field">
            <label>পেশা</label>
            <input id="f_occ" value="${esc(d.occ || '')}" placeholder="যেমন: গৃহিণী, দিনমজুর, কৃষক, ইত্যাদি">
          </div>
          <div class="field">
            <label>মাসিক পারিবারিক আয়</label>
            <select id="f_income">
              <option value="below_15k" ${d.income === 'below_15k' ? 'selected' : ''}>১৫,০০০ টাকার নিচে</option>
              <option value="15k_25k" ${d.income === '15k_25k' ? 'selected' : ''}>১৫,০০০ - ২৫,০০০ টাকা</option>
              <option value="above_25k" ${d.income === 'above_25k' ? 'selected' : ''}>২৫,০০০ টাকার উপরে</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:.9rem">
          <label>পরিবারের নির্ভরশীল সদস্য সংখ্যা</label>
          <input id="f_deps" type="number" min="0" value="${esc(d.deps || '')}" placeholder="যেমন: ৪">
        </div>
      `);
    } else if (state.step === 5) {
      stepHtml(`
        <div class="field">
          <label>প্রতিপক্ষের পুরো নাম (যদি জানা থাকে)</label>
          <input id="f_oppName" value="${esc(d.oppName || '')}" placeholder="যার বিরুদ্ধে অভিযোগ বা বিরোধ">
        </div>
        <div class="form-grid" style="margin-top:.9rem">
          <div class="field">
            <label>প্রতিপক্ষের ধরন</label>
            <select id="f_oppType">
              <option>ব্যক্তি</option>
              <option>প্রতিষ্ঠান/কোম্পানি</option>
              <option>সরকারি অফিস</option>
              <option>অজানা</option>
            </select>
          </div>
          <div class="field">
            <label>প্রতিপক্ষের ফোন নম্বর (যদি জানা থাকে)</label>
            <input id="f_oppPhone" value="${esc(d.oppPhone || '')}" placeholder="01XXXXXXXXX">
          </div>
        </div>
        <div class="quick-ans" style="margin-top:1rem">
          🔒 <strong>সুরক্ষিত রেকর্ড:</strong> প্রতিপক্ষকে কখনই আপনার যোগাযোগের সংবেদনশীল তথ্য জানানো হয় না।
        </div>
      `);
    } else {
      const d2 = state.data;
      const catObj = allCategories.find(c => c.id === d2.caseType);
      stepHtml(`
        <h3>আপনার আবেদন যাচাই করুন</h3>
        <div class="quick-ans" style="margin-top:.8rem">
          <p><strong>আইনি বিষয়:</strong> ${catObj ? esc(catObj.title) : 'সাধারণ আইনি সমস্যা'}</p>
          <p><strong>আবেদনকারী:</strong> ${esc(d2.name || '—')} · <strong>ফোন:</strong> ${esc(d2.phone || '—')}</p>
          <p><strong>জেলা:</strong> ${esc(d2.district || '—')} · <strong>পরিচয়পত্র:</strong> ${d2.idType === 'none' ? 'উপলব্ধ নয়' : (d2.idType === 'birth_cert' ? 'জন্মনিবন্ধন' : 'এনআইডি')} (${esc(d2.nid || '—')})</p>
          ${d2.isRep ? `<p><strong>মনোনীত প্রতিনিধি:</strong> ${esc(d2.repName)} (${esc(d2.repRelation)} · ${esc(d2.repPhone)})</p>` : ''}
          <p><strong>জরুরি অগ্রাধিকার:</strong> ${d2.emergency ? 'হ্যাঁ' : 'না'} · <strong>স্পর্শকাতর সুরক্ষা:</strong> ${d2.sensitive ? 'হ্যাঁ' : 'না'}</p>
        </div>

        <!-- আইনগত সম্মতি ও সঠিক রেফারেন্স (PDF 2 কেইস এ১ Requirement) -->
        <div style="background:var(--surface-2);border-radius:10px;padding:1.1rem;border:1px solid #A7F3D0;margin-top:1rem;font-size:0.88rem;line-height:1.6">
          🛡️ <strong>আপনার তথ্য সুরক্ষা ও আইনি অধিকার:</strong>
          বাংলাদেশ লিগ্যাল এইড ডিরেক্টরেট আপনার আবেদন নিষ্পত্তি ও আইনি সহায়তা দেওয়ার জন্য এই তথ্য সংগ্রহ করে। কেবল আপনার দায়িত্বপ্রাপ্ত কর্মকর্তা, প্যানেল আইনজীবী বা মধ্যস্থতাকারী এটি দেখেন; প্রতিপক্ষকে কখনই জানানো হয় না।
          তথ্যটি <strong>ব্যক্তিগত উপাত্ত সুরক্ষা আইন, ২০২৬ (২০২৬ সনের ৬৩ নং আইন)</strong> অনুযায়ী সুরক্ষিত থাকে।
        </div>

        <label class="check-line" style="margin-top:1rem">
          <input type="checkbox" id="f_true">
          <span>আমি নিশ্চিত করছি যে উপরে প্রদত্ত সকল তথ্য সত্য ও সঠিক।</span>
        </label>
        <div id="applyErr" class="form-error hidden"></div>
      `);
    }
  }

  function collect() {
    const d = state.data;
    if (state.step === 1) {
      d.caseType = $('#f_caseType').value;
      d.purpose = $('#f_purpose').value;
      d.district = $('#f_district').value;
      d.problem = $('#f_problem').value.trim();
      d.emergency = $('#f_emergency').checked;
      d.sensitive = $('#f_sensitive').checked;
      if (!d.problem) { toast('সমস্যার সংক্ষিপ্ত বিবরণ লিখুন'); return false; }
    } else if (state.step === 2) {
      d.name = $('#f_name').value.trim();
      d.gender = $('#f_gender').value;
      d.age = $('#f_age').value;
      d.idType = $('#f_idType').value;
      const nidInp = $('#f_nid');
      d.nid = (nidInp && d.idType !== 'none') ? nidInp.value.trim() : '';
      if (!d.name) { toast('আবেদনকারীর পুরো নাম লিখুন'); return false; }
      if (d.isRep) {
        d.repName = ($('#f_repName')?.value || '').trim();
        d.repPhone = ($('#f_repPhone')?.value || '').trim();
        d.repRelation = ($('#f_repRelation')?.value || '').trim();
      }
    } else if (state.step === 3) {
      d.phone = $('#f_phone').value.trim();
      d.phoneType = $('#f_phoneType').value;
      d.window = $('#f_window').value.trim();
      d.safeNumber = $('#f_safe').value.trim();
      if (!/^01\d{9}$/.test(d.phone)) {
        toast('সঠিক ১১ ডিজিটের ফোন নম্বর দিন (01XXXXXXXXX)');
        return false;
      }
    } else if (state.step === 4) {
      d.occ = $('#f_occ').value.trim();
      d.income = $('#f_income').value;
      d.deps = $('#f_deps').value;
    } else if (state.step === 5) {
      d.oppName = $('#f_oppName').value.trim();
      d.oppType = $('#f_oppType').value;
      d.oppPhone = $('#f_oppPhone').value.trim();
    } else {
      if (!$('#f_true').checked) {
        toast('তথ্য সঠিক বলে বক্সে টিক চিহ্ন দিন');
        return false;
      }
    }
    return true;
  }

  async function submit() {
    const d = state.data;
    if (d.safeNumber || d.window) {
      d.safeContact = {
        safeNumber: d.safeNumber || d.phone,
        window: d.window || 'সকাল ১০টা - বিকাল ৪টা',
        neutralWording: true
      };
    }
    if (d.isRep && d.repName) {
      d.representation = {
        repName: d.repName,
        repPhone: d.repPhone,
        relation: d.repRelation,
        scope: 'intake-only'
      };
    }

    const nextBtn = $('#aNext');
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'জমা হচ্ছে...';
    }

    const r = await apiPost('applications', d);

    if (!r.ok && !r.success) {
      toast(r.error || t('errGeneric'));
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = '✓ জমা দিন';
      }
      return;
    }

    const finalAppId = r.appId || r.applicationId || ('APP-2026-' + Math.floor(1000 + Math.random() * 9000));

    // Save locally to citizen's localStorage dashboard store
    try {
      const stored = JSON.parse(localStorage.getItem('dlas_my_apps') || '[]');
      stored.unshift({
        appId: finalAppId,
        name: d.name || 'আবেদনকারী',
        phone: d.phone || '',
        caseType: d.caseType || 'পারিবারিক/সাধারণ',
        purpose: d.purpose || 'আইনজীবী নিয়োগ',
        district: d.district || '',
        submittedAt: new Date().toISOString(),
        status: 'অপেক্ষমাণ (UNDER_REVIEW)',
        stage: 0,
        problem: d.problem || d.facts || '',
        oppName: d.oppName || '',
        emergency: !!d.emergency
      });
      localStorage.setItem('dlas_my_apps', JSON.stringify(stored.slice(0, 50)));
    } catch (e) {}

    app.innerHTML = `
    <div class="container page-head">
      <h1>✅ আপনার আইনি সহায়তা আবেদন সফলভাবে জমা হয়েছে</h1>
    </div>
    <div class="container">
      <div class="form-card" style="text-align:center;max-width:740px">
        <p style="color:var(--text-muted)">আপনার আবেদন ট্র্যাকিং আইডি:</p>
        <div style="font-size:2rem;font-weight:800;font-family:monospace;color:var(--gov-green);margin:.5rem 0 1rem">
          ${esc(finalAppId)}
        </div>
        
        <div class="quick-ans" style="text-align:left;background:var(--gov-green-surface);border-color:#A7F3D0">
          🆓 <strong>বিনামূল্যে সরকারি সেবা:</strong> এই আবেদন ও তৎপরবর্তী সকল আইনি সহায়তা সম্পূর্ণ বিনামূল্যে। কোনো ফি প্রদান করবেন না।
        </div>

        <div style="background:var(--surface-2);border-radius:10px;padding:1.2rem;text-align:left;margin-top:1.2rem">
          <strong>পরবর্তী করণীয় ও ধাপসমূহ:</strong>
          <ul style="margin:.6rem 0 0 1.4rem;font-size:0.92rem;line-height:1.6">
            <li>উপজেলা বা জেলা লিগ্যাল এইড কর্মকর্তা আবেদনটি পর্যালোচনা করবেন।</li>
            <li>আপনার মোবাইল নম্বরে এসএমএস এর মাধ্যমে আপডেট পাঠানো হবে।</li>
            <li>নিচের বোতামে ক্লিক করে যেকোনো সময় আবেদনের সরাসরি অগ্রগতি দেখতে পারবেন।</li>
          </ul>
        </div>

        <div class="wizard-actions" style="justify-content:center;gap:12px;margin-top:1.8rem">
          <a class="btn btn-outline" href="#/track?id=${encodeURIComponent(finalAppId)}&last4=${encodeURIComponent((d.phone || '3344').slice(-4))}">
            🔍 আবেদন ট্র্যাক করুন
          </a>
          <a class="btn btn-primary" href="#/dashboard">
            👤 নাগরিক ড্যাশবোর্ডে দেখুন
          </a>
          <a class="btn btn-ghost" href="#/">
            🏠 হোমে যান
          </a>
        </div>
      </div>
    </div>`;
  }
}

// ---------- ৭. নাগরিক ও সার্বিক ড্যাশবোর্ড (pageDashboard) ----------
async function pageDashboard() {
  const localApps = JSON.parse(localStorage.getItem('dlas_my_apps') || '[]');
  let serverApps = [];

  try {
    const r = await apiGet('applications');
    serverApps = r.applications || [];
  } catch (e) {
    console.warn('Failed to load server applications:', e);
  }

  // Merge server and local applications uniquely by appId
  const combinedMap = new Map();
  serverApps.forEach(a => { if (a && a.appId) combinedMap.set(a.appId, a); });
  localApps.forEach(a => {
    if (a && a.appId) {
      if (combinedMap.has(a.appId)) {
        combinedMap.set(a.appId, Object.assign({}, combinedMap.get(a.appId), a));
      } else {
        combinedMap.set(a.appId, a);
      }
    }
  });

  let allApps = Array.from(combinedMap.values());

  // Default seed apps if completely empty
  if (!allApps.length) {
    allApps = [
      {
        appId: 'DLAS-NET-2026-04420',
        name: 'ময়ূরী আক্তার',
        phone: '01711223344',
        district: 'নেত্রকোনা',
        caseType: 'পারিবারিক ও দেনমোহর বিরোধ',
        purpose: 'সরকারি খরচে আইনজীবী নিয়োগ',
        submittedAt: '2026-09-18T10:30:00Z',
        stage: 1,
        status: 'পর্যালোচনাধীন (UNDER_REVIEW)',
        emergency: false,
        problem: 'স্বামী দীর্ঘদিন যাবৎ কোনো ভরণপোষণ দিচ্ছেন না এবং যৌতুকের দাবিতে নির্যাতন করছেন।'
      },
      {
        appId: 'DLAS-JOY-2026-01120',
        name: 'রফিকুল ইসলাম',
        phone: '01812345678',
        district: 'জয়পুরহাট',
        caseType: 'ভূমি ও সম্পত্তি বিরোধ',
        purpose: 'বিকল্প বিরোধ নিষ্পত্তি (ADR)',
        submittedAt: '2026-09-20T14:15:00Z',
        stage: 3,
        status: 'মধ্যস্থতা প্রক্রিয়া চলমান (MEDIATION)',
        emergency: false,
        problem: 'পৈতৃক ভিটেমাটির সীমানা নির্ধারণ নিয়ে প্রতিবেশীর সঙ্গে বিরোধ।'
      },
      {
        appId: 'DLAS-DHK-2026-00812',
        name: 'সাহেদা বেগম',
        phone: '01998877665',
        district: 'ঢাকা',
        caseType: 'নারী ও শিশু নির্যাতন দমন',
        purpose: 'সরকারি খরচে আইনজীবী নিয়োগ',
        submittedAt: '2026-09-22T09:00:00Z',
        stage: 2,
        status: 'আইনজীবী নির্ধারিত (LAWYER_ASSIGNED)',
        emergency: true,
        problem: 'যৌতুক ও পারিবারিক সহিংসতার শিকার, দ্রুত জামিন ও আইনি সুরক্ষার আবেদন।'
      }
    ];
  }

  // Stage styling helpers
  const stageBadges = [
    { label: '📝 নতুন দাখিল', cls: 'badge-stage-0' },
    { label: '🔍 পর্যালোচনাধীন', cls: 'badge-stage-1' },
    { label: '⚖️ আইনজীবী নির্ধারিত', cls: 'badge-stage-2' },
    { label: '🤝 মধ্যস্থতা/শুনানি', cls: 'badge-stage-3' },
    { label: '✅ নিষ্পত্তি সম্পন্ন', cls: 'badge-stage-4' }
  ];

  let currentTab = 'all';
  let currentSearch = '';

  app.innerHTML = `
  <div class="container page-head">
    <div class="dash-hero">
      <div class="dash-avatar">⚖️</div>
      <div>
        <h1>আইনি সহায়তা ড্যাশবোর্ড</h1>
        <p>${ME ? 'স্বাগতম, <strong>' + esc(ME.name || 'সম্মানিত ব্যবহারকারী') + '</strong>! (' + esc(ME.role || 'নাগরিক') + ')' : 'দাখিলকৃত সকল আবেদন, আইনজীবী নিয়োগ ও মধ্যস্থতার সরাসরি অবস্থা'}</p>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn-primary btn-sm" href="#/apply">+ নতুন আবেদন দাখিল</a>
        ${ME ? `<button class="btn btn-outline btn-sm" id="d_logout">${t('logout')}</button>` : `<a class="btn btn-outline btn-sm" href="#/login">লগইন</a>`}
      </div>
    </div>
  </div>

  <div class="container">
    <!-- পরিসংখ্যান কার্ডসমূহ -->
    <div class="dash-grid" id="dashStatsGrid">
      <div class="stat-card">
        <h3>মোট আবেদন</h3>
        <div class="stat-num" id="statTotal">${bnNum(allApps.length)}</div>
      </div>
      <div class="stat-card">
        <h3>পর্যালোচনাধীন</h3>
        <div class="stat-num" id="statReview">${bnNum(allApps.filter(a => (a.stage === 0 || a.stage === 1)).length)}</div>
      </div>
      <div class="stat-card">
        <h3>আদালত / মধ্যস্থতায়</h3>
        <div class="stat-num" id="statActive">${bnNum(allApps.filter(a => (a.stage === 2 || a.stage === 3)).length)}</div>
      </div>
      <div class="stat-card">
        <h3>নিষ্পত্তি সম্পন্ন</h3>
        <div class="stat-num" id="statClosed">${bnNum(allApps.filter(a => (a.stage || 0) >= 4).length)}</div>
      </div>
    </div>

    <!-- টুলবার: ফিল্টার ও রিয়েলটাইম সার্চ -->
    <div class="dash-toolbar-card">
      <div class="dash-filter-tabs">
        <button type="button" class="dash-tab-btn active" data-tab="all">সকল আবেদন (${bnNum(allApps.length)})</button>
        <button type="button" class="dash-tab-btn" data-tab="new">নতুন দাখিল (${bnNum(allApps.filter(a => (a.stage === 0)).length)})</button>
        <button type="button" class="dash-tab-btn" data-tab="review">পর্যালোচনাধীন (${bnNum(allApps.filter(a => a.stage === 1).length)})</button>
        <button type="button" class="dash-tab-btn" data-tab="lawyer">আইনজীবী নিয়োগ</button>
        <button type="button" class="dash-tab-btn" data-tab="adr">মধ্যস্থতা (ADR)</button>
        <button type="button" class="dash-tab-btn" data-tab="emergency">🚨 জরুরি (${bnNum(allApps.filter(a => a.emergency).length)})</button>
      </div>
      <div class="dash-search-row">
        <input type="text" id="dashSearchInput" class="dash-search-input" placeholder="আবেদন আইডি, নাম, ফোন নম্বর বা জেলা লিখে খুঁজুন..." autocomplete="off">
      </div>
    </div>

    <!-- টেবিল ও তালিকা কন্টেইনার -->
    <div id="dashAppsContainer"></div>
  </div>

  <!-- বিস্তারিত মডাল কন্টেইনার -->
  <div id="appDetailModalWrap"></div>
  `;

  const container = $('#dashAppsContainer');
  const modalWrap = $('#appDetailModalWrap');

  function showAppDetail(a) {
    const st = stageBadges[a.stage || 0] || stageBadges[0];
    const subDate = a.submittedAt ? new Date(a.submittedAt).toLocaleString('bn-BD', { dateStyle: 'long', timeStyle: 'short' }) : '২০২৬';
    
    modalWrap.innerHTML = `
      <div class="app-modal-overlay" id="modalOverlay">
        <div class="app-modal-box">
          <button class="app-modal-close" id="btnModalClose">✕</button>
          
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap">
            <span class="badge info" style="font-size:1rem;font-family:monospace;font-weight:700">${esc(a.appId)}</span>
            <span class="badge-stage ${st.cls}">${st.label}</span>
            ${a.emergency ? `<span class="badge warn">🚨 জরুরি সেবা</span>` : ''}
          </div>

          <h2 style="font-size:1.35rem;color:#0F2D24;margin-bottom:1.25rem">📋 আবেদন বিবরণী ও সার্বিক অবস্থা</h2>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:1.2rem;margin-bottom:1.2rem;font-size:0.92rem">
            <div><strong>আবেদনকারীর নাম:</strong> ${esc(a.name || 'নাগরিক')}</div>
            <div><strong>মোবাইল নম্বর:</strong> ${esc(a.phone || '–')}</div>
            <div><strong>জেলা:</strong> ${esc(a.district || '–')}</div>
            <div><strong>উপজেলা/ইউনিয়ন:</strong> ${esc(a.upazila || a.union || 'সদর')}</div>
            <div><strong>বিরোধের ধরন:</strong> ${esc(a.caseType || 'পারিবারিক/সাধারণ')}</div>
            <div><strong>সেবার উদ্দেশ্য:</strong> ${esc(a.purpose || 'সরকারি খরচে আইনজীবী')}</div>
            <div style="grid-column:1/-1"><strong>দাখিলের তারিখ:</strong> ${esc(subDate)}</div>
          </div>

          <div style="margin-bottom:1.2rem">
            <h4 style="font-size:1rem;margin-bottom:6px;color:#1E293B">ঘটনা ও আইনি দাবির বিবরণ:</h4>
            <div style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:8px;padding:1rem;font-size:0.93rem;line-height:1.65;color:#334155">
              ${esc(a.problem || a.facts || 'আইনি সহায়তা ও পরামর্শ চেয়ে আবেদন দাখিল করা হয়েছে। সংশ্লিষ্ট জেলা লিগ্যাল এইড অফিসার নথি ও তথ্যাবলি যাচাই করছেন।')}
            </div>
          </div>

          ${a.oppName ? `
            <div style="margin-bottom:1.2rem;font-size:0.9rem">
              <strong>প্রতিপক্ষের তথ্য:</strong> ${esc(a.oppName)} ${a.oppPhone ? '(' + esc(a.oppPhone) + ')' : ''}
            </div>
          ` : ''}

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap">
            <a class="btn btn-outline btn-sm" href="#/track?id=${encodeURIComponent(a.appId)}&last4=${encodeURIComponent((a.phone || '3344').slice(-4))}">
              🔍 সরাসরি লাইভ ট্র্যাক করুন →
            </a>
            <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ প্রিন্ট</button>
            <button class="btn btn-primary btn-sm" id="btnModalOk">ঠিক আছে</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalWrap.innerHTML = ''; };
    $('#btnModalClose').onclick = close;
    $('#btnModalOk').onclick = close;
    $('#modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') close(); };
  }

  function renderTable() {
    let filtered = allApps;

    // Filter by tab
    if (currentTab === 'new') {
      filtered = filtered.filter(a => (a.stage === 0));
    } else if (currentTab === 'review') {
      filtered = filtered.filter(a => a.stage === 1);
    } else if (currentTab === 'lawyer') {
      filtered = filtered.filter(a => (a.purpose && a.purpose.includes('আইনজীবী')) || (a.caseType && a.caseType.includes('মামলা')));
    } else if (currentTab === 'adr') {
      filtered = filtered.filter(a => (a.purpose && a.purpose.includes('মধ্যস্থতা')) || (a.purpose && a.purpose.includes('ADR')) || a.stage === 3);
    } else if (currentTab === 'emergency') {
      filtered = filtered.filter(a => a.emergency);
    }

    // Filter by search query
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(a => 
        (a.appId || '').toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.phone || '').toLowerCase().includes(q) ||
        (a.district || '').toLowerCase().includes(q) ||
        (a.caseType || '').toLowerCase().includes(q) ||
        (a.problem || '').toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:3rem 1.5rem;background:#FFFFFF;border-radius:14px;border:1.5px solid #E2E8F0">
          <div style="font-size:2.5rem;margin-bottom:10px">📭</div>
          <h3>কোনো আবেদন পাওয়া যায়নি</h3>
          <p style="color:var(--text-muted);margin:8px 0 16px">অনুসন্ধানের শব্দ পরিবর্তন করুন অথবা সরাসরি নতুন আবেদন দাখিল করুন।</p>
          <a class="btn btn-primary btn-sm" href="#/apply">+ নতুন আবেদন দাখিল করুন</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="app-table-wrap">
        <table class="app-table">
          <thead>
            <tr>
              <th>আবেদন ট্র্যাকিং আইডি</th>
              <th>আবেদনকারীর নাম ও ফোন</th>
              <th>জেলা</th>
              <th>সেবার ধরন</th>
              <th>দাখিলের তারিখ</th>
              <th>বর্তমান পর্যায়</th>
              <th style="text-align:right">কার্যক্রম</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(a => {
              const st = stageBadges[a.stage || 0] || stageBadges[0];
              const dt = a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('bn-BD') : '২০২৬';
              const phoneLast4 = (a.phone || '3344').slice(-4);
              return `
                <tr data-id="${esc(a.appId)}">
                  <td>
                    <span style="font-family:monospace;font-weight:700;color:#00543E;font-size:0.92rem;background:#ECFDF5;padding:3px 8px;border-radius:6px;border:1px solid #A7F3D0">
                      ${esc(a.appId)}
                    </span>
                    ${a.emergency ? `<div style="font-size:0.75rem;color:#DC2626;font-weight:700;margin-top:3px">🚨 জরুরি</div>` : ''}
                  </td>
                  <td>
                    <strong style="color:#0F172A">${esc(a.name || 'নাগরিক')}</strong>
                    <div style="font-size:0.8rem;color:#64748B">${esc(a.phone || '–')}</div>
                  </td>
                  <td>${esc(a.district || '–')}</td>
                  <td>
                    <div style="font-weight:600;color:#334155">${esc(a.purpose || 'আইনজীবী নিয়োগ')}</div>
                    <div style="font-size:0.8rem;color:#64748B">${esc(a.caseType || 'পারিবারিক বিরোধ')}</div>
                  </td>
                  <td>${esc(dt)}</td>
                  <td>
                    <span class="badge-stage ${st.cls}">${st.label}</span>
                  </td>
                  <td style="text-align:right">
                    <div style="display:inline-flex;gap:6px">
                      <a class="btn-dash-action" href="#/track?id=${encodeURIComponent(a.appId)}&last4=${encodeURIComponent(phoneLast4)}">
                        🔍 ট্র্যাক
                      </a>
                      <button type="button" class="btn-dash-action btn-view-detail" data-id="${esc(a.appId)}">
                        📄 বিস্তারিত
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Bind detail buttons
    $$('.btn-view-detail', container).forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const target = allApps.find(x => x.appId === id);
        if (target) showAppDetail(target);
      };
    });
  }

  renderTable();

  // Tab filtering
  $$('.dash-tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('.dash-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderTable();
    };
  });

  // Search input
  const sInput = $('#dashSearchInput');
  if (sInput) {
    let sTimer;
    sInput.oninput = (e) => {
      clearTimeout(sTimer);
      sTimer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        renderTable();
      }, 150);
    };
  }

  // Logout button
  const logoutBtn = $('#d_logout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await apiPost('logout', {});
      ME = null;
      renderAuthLink();
      location.hash = '#/';
      toast('লগআউট সম্পন্ন হয়েছে');
    };
  }
}

// ---------- ৮. আধুনিক পরিষ্কার লগইন প্যানেল (pageLogin) — Executive Redesign ----------
async function pageLogin() {
  if (ME) {
    if (ME.role && ME.role !== 'applicant' && ME.role !== 'CITIZEN') {
      return (location.hash = '#/console');
    }
    return (location.hash = '#/dashboard');
  }

  let activeTab = 'citizen'; // 'citizen', 'staff', 'door'

  function render() {
    app.innerHTML = `
    <div class="container auth-clean-wrap">
      <div class="auth-clean-card">
        <div class="auth-clean-header">
          <h1>🏛️ CoU JusticeLab পোর্টাল</h1>
          <p>ডিজিটাল আইনগত সহায়তা ও সেবা ব্যবস্থাপনা — অ্যাকাউন্টে প্রবেশ করুন</p>
        </div>

        <!-- ৩টি স্পষ্ট ভূমিকা বাটন (3 Clean Role Tabs) -->
        <div class="auth-role-tabs">
          <button type="button" class="auth-role-btn ${activeTab === 'citizen' ? 'active' : ''}" id="tabBtnCitizen">
            👤 নাগরিক লগইন
          </button>
          <button type="button" class="auth-role-btn ${activeTab === 'staff' ? 'active' : ''}" id="tabBtnStaff">
            🏛️ কর্মকর্তা / প্রোভাইডার
          </button>
          <button type="button" class="auth-role-btn ${activeTab === 'door' ? 'active' : ''}" id="tabBtnDoor">
            🚪 ডোর / হেল্পলাইন
          </button>
        </div>

        <div id="loginErr" class="form-error hidden"></div>

        <!-- ১. নাগরিক লগইন -->
        <div id="loginCitizenForm" class="${activeTab === 'citizen' ? '' : 'hidden'}">
          <div class="field">
            <label>মোবাইল নম্বর বা আবেদন আইডি <span class="req">*</span></label>
            <input id="c_id" placeholder="যেমন: 01711223344 বা APP-2026-0001" value="01711223344">
          </div>
          <div class="field" style="margin-top:1rem">
            <label>৪-সংখ্যার পিন (PIN) <span class="req">*</span></label>
            <input id="c_pin" type="password" maxlength="6" value="3344" placeholder="••••">
            <div class="hint">ডেমো পিন: 3344 (ময়ূরী আক্তার)</div>
          </div>
          <button class="btn btn-primary btn-block" id="btnCitizenSubmit" style="margin-top:1.4rem">
            👤 নাগরিক অ্যাকাউন্টে প্রবেশ করুন →
          </button>
        </div>

        <!-- ২. কর্মকর্তা / প্রোভাইডার লগইন -->
        <div id="loginStaffForm" class="${activeTab === 'staff' ? '' : 'hidden'}">
          <div class="auth-quick-preset-select">
            <label><strong>পদবী নির্বাচন করুন (স্বয়ংক্রিয় পূরণ):</strong></label>
            <select id="staffPresetSelect">
              <option value="officer.joypurhat|1234">রহিমা খাতুন — DLAO কর্মকর্তা (জয়পুরহাট)</option>
              <option value="lawyer.kabir|1234">অ্যাডভ. কবির হোসেন — প্যানেল আইনজীবী</option>
              <option value="mediator.joypurhat|1234">নাসরিন সুলতানা — মধ্যস্থতাকারী (ADR)</option>
              <option value="receiving.dhaka|1234">তানভীর আহমেদ — গ্রহণকারী DLAO (ঢাকা)</option>
              <option value="udc.khagrachari|1234">জয়ন্ত চাকমা — UDC উদ্যোক্তা</option>
              <option value="admin|1234">সিস্টেম প্রশাসক (Admin)</option>
            </select>
          </div>

          <div class="field">
            <label>ব্যবহারকারী নাম (Username) <span class="req">*</span></label>
            <input id="s_user" value="officer.joypurhat" placeholder="যেমন: officer.joypurhat">
          </div>
          <div class="field" style="margin-top:1rem">
            <label>৪-সংখ্যার পিন (PIN) <span class="req">*</span></label>
            <input id="s_pin" type="password" value="1234" maxlength="8" placeholder="••••">
          </div>
          <button class="btn btn-primary btn-block" id="btnStaffSubmit" style="margin-top:1.4rem">
            🏛️ কর্মকর্তা পোর্টালে প্রবেশ করুন →
          </button>
        </div>

        <!-- ৩. ডোর / দ্রুত এক্সেস -->
        <div id="loginDoorForm" class="${activeTab === 'door' ? '' : 'hidden'}">
          <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem">
            হেল্পলাইন ১৬৬৯৯ এজেন্ট বা ইউনিয়ন ডিজিটাল সেন্টার (UDC) অপারেটরদের জন্য দ্রুত প্রবেশ ব্যবস্থা:
          </p>
          <div class="field">
            <label>প্রবেশ কোড বা এজেন্ট আইডি</label>
            <input id="d_code" value="helpline.agent1" placeholder="helpline.agent1">
          </div>
          <button class="btn btn-primary btn-block" id="btnDoorSubmit" style="margin-top:1.4rem">
            🚪 এক্সেস করুন →
          </button>
        </div>
      </div>
    </div>`;

    $('#tabBtnCitizen').onclick = () => { activeTab = 'citizen'; render(); };
    $('#tabBtnStaff').onclick = () => { activeTab = 'staff'; render(); };
    $('#tabBtnDoor').onclick = () => { activeTab = 'door'; render(); };

    const presetSel = $('#staffPresetSelect');
    if (presetSel) {
      presetSel.onchange = () => {
        const [u, p] = presetSel.value.split('|');
        $('#s_user').value = u;
        $('#s_pin').value = p;
      };
    }

    const showErr = (msg) => {
      const e = $('#loginErr');
      e.textContent = msg;
      e.classList.remove('hidden');
    };

    // Citizen login
    const btnC = $('#btnCitizenSubmit');
    if (btnC) {
      btnC.onclick = async () => {
        const id = $('#c_id').value.trim();
        const pin = $('#c_pin').value.trim();
        if (!id || !pin) return showErr('মোবাইল নম্বর ও পিন উভয়ই প্রদান করুন');

        const r = await apiPost('auth', { mode: 'citizen', phone: id, pin });
        if (r.error) return showErr(r.error);
        ME = r.user || { name: 'নাগরিক', role: 'CITIZEN' };
        renderAuthLink();
        location.hash = '#/dashboard';
        toast('সফলভাবে লগইন হয়েছে');
      };
    }

    // Staff login
    const btnS = $('#btnStaffSubmit');
    if (btnS) {
      btnS.onclick = async () => {
        const username = $('#s_user').value.trim();
        const pin = $('#s_pin').value.trim();
        if (!username || !pin) return showErr('ইউজারনেম ও পিন দিন');

        const r = await apiPost('auth', { mode: 'staff', username, pin });
        if (r.error) return showErr(r.error);
        ME = r.user || { name: username, role: 'OFFICER' };
        renderAuthLink();
        location.hash = '#/console';
        toast('কর্মকর্তা কনসোলে প্রবেশ সম্পন্ন');
      };
    }

    // Door login
    const btnD = $('#btnDoorSubmit');
    if (btnD) {
      btnD.onclick = async () => {
        const code = $('#d_code').value.trim();
        const r = await apiPost('auth', { mode: 'staff', username: code, pin: '1234' });
        if (r.error) return showErr(r.error);
        ME = r.user || { name: code, role: 'UDC' };
        renderAuthLink();
        location.hash = '#/console';
      };
    }
  }

  render();
}

// ---------- অন্যান্য পেজসমূহ ----------
async function pageEligibility() {
  app.innerHTML = `
  <div class="container page-head">
    <span class="section-tag">যোগ্যতা যাচাই</span>
    <h1>⚖️ আইনি সহায়তা পাওয়ার যোগ্যতা ক্যালকুলেটর</h1>
    <p>আইনগত সহায়তা প্রদান নীতিমালা ২০১৪ অনুসারে আপনার বিনামূল্যে সেবা পাওয়ার অধিকার তাৎক্ষণিক পরীক্ষা করুন।</p>
  </div>
  <div class="container">
    <div class="form-card" style="max-width:720px">
      <div class="field">
        <label>আপনার মাসিক পারিবারিক আয় কত?</label>
        <select id="el_income">
          <option value="12000">১৫,০০০ টাকার নিচে (দরিদ্র/অসচ্ছল)</option>
          <option value="20000">১৫,০০০ - ২৫,০০০ টাকা</option>
          <option value="35000">২৫,০০০ টাকার উপরে</option>
        </select>
      </div>
      <div class="field" style="margin-top:1rem">
        <label>বিশেষ অধিকার বা অগ্রাধিকার:</label>
        <select id="el_spec">
          <option value="none">সাধারণ নাগরিক</option>
          <option value="women">নারী ও শিশু নির্যাতনের শিকার</option>
          <option value="freedom">বীর মুক্তিযোদ্ধা</option>
          <option value="disabled">প্রতিবন্ধী ব্যক্তি</option>
          <option value="prisoner">আটক বিচারাধীন বন্দি</option>
        </select>
      </div>
      <button class="btn btn-primary" id="btnCheckEl" style="margin-top:1.2rem">যোগ্যতা পরীক্ষা করুন</button>
      <div id="elResult" style="margin-top:1.2rem"></div>
    </div>
  </div>`;

  $('#btnCheckEl').onclick = () => {
    const inc = parseInt($('#el_income').value, 10);
    const spec = $('#el_spec').value;
    const ok = inc <= 25000 || spec !== 'none';
    $('#elResult').innerHTML = ok
      ? `<div style="background:var(--gov-green-surface);padding:1rem;border-radius:8px;border:1px solid #A7F3D0">
          <h4 style="color:var(--gov-green-dark)">✅ আপনি সরকারি খরচে বিনামূল্যে আইনি সেবা পাওয়ার সম্পূর্ণ যোগ্য!</h4>
          <p style="margin-top:6px;font-size:0.9rem">আপনি আইনজীবী নিয়োগ, পরামর্শ ও মধ্যস্থতার সকল সুবিধা সম্পূর্ণ রাষ্ট্রীয় খরচে পাবেন।</p>
          <a class="btn btn-primary btn-sm" href="#/apply" style="margin-top:10px">আবেদন দাখিল করুন →</a>
        </div>`
      : `<div style="background:var(--surface-2);padding:1rem;border-radius:8px;border:1px solid var(--border)">
          <h4>ℹ️ আপনি আইনি পরামর্শ ও মধ্যস্থতার সেবা গ্রহণ করতে পারেন।</h4>
          <p style="margin-top:6px;font-size:0.9rem">আইনজীবী নিয়োগের ক্ষেত্রে জেলা কমিটির বিশেষ অনুমোদন প্রয়োজন হতে পারে।</p>
          <a class="btn btn-outline btn-sm" href="#/guide" style="margin-top:10px">পরামর্শ গাইড দেখুন →</a>
        </div>`;
  };
}

// ---------- ৬. ৬৪ জেলা লিগ্যাল এইড অফিস ও লাইভ ম্যাপ (pageOffices) ----------
async function pageOffices() {
  let offices = (BOOT && BOOT.offices) || [];
  if (!offices.length) {
    try {
      const res = await apiGet('offices');
      offices = res.offices || [];
    } catch (e) {}
  }

  app.innerHTML = `
  <div class="container page-head">
    <span class="section-tag">দেশব্যাপী নেটওয়ার্ক</span>
    <h1>🗺️ ৬৪ জেলা লিগ্যাল এইড অফিস ও লাইভ ম্যাপ</h1>
    <p>আপনার নিকটস্থ জেলা জজ আদালত ভবনে অবস্থিত লিগ্যাল এইড অফিসে সরাসরি যোগাযোগ করুন বা ম্যাপে অবস্থান দেখুন।</p>
  </div>
  <div class="container">
    <div class="offices-split-layout">
      <!-- বাম কলাম: সার্চ ও স্ক্রলেবল তালিকা -->
      <div class="offices-list-container">
        <input type="text" id="offSearch" class="offices-search-box" placeholder="জেলার নাম লিখুন — যেমন: নেত্রকোনা, জয়পুরহাট, ঢাকা..." autocomplete="off">
        <div id="offCount" style="font-size:0.88rem;color:var(--text-muted);margin-bottom:0.75rem;font-weight:600"></div>
        <div class="offices-scroll-list" id="offList"></div>
      </div>

      <!-- ডান কলাম: লাইভ ইন্টারঅ্যাক্টিভ ম্যাপ -->
      <div>
        <div class="offices-map-container" id="districtMap"></div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;display:flex;justify-content:space-between">
          <span>💡 তালিকায় বা ম্যাপের পিনে ক্লিক করে সরাসরি লোকেশন ও তথ্য দেখুন।</span>
          <span>সর্বমোট ${bnNum(offices.length)}টি কেন্দ্র</span>
        </div>
      </div>
    </div>
  </div>`;

  const offList = $('#offList');
  const offSearch = $('#offSearch');
  const offCount = $('#offCount');
  const mapEl = $('#districtMap');

  let activeOfficeId = null;
  let leafletMap = null;
  const markerInstances = new Map();

  const createPinIcon = (isActive = false) => {
    return (window.L && L.divIcon) ? L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="
        width: ${isActive ? '32px' : '24px'};
        height: ${isActive ? '32px' : '24px'};
        background: ${isActive ? '#C2410C' : '#00543E'};
        color: #fff;
        border: 2px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      ">
        <span style="transform: rotate(45deg); font-size: ${isActive ? '14px' : '11px'}; line-height: 1;">⚖️</span>
      </div>`,
      iconSize: [isActive ? 32 : 24, isActive ? 32 : 24],
      iconAnchor: [isActive ? 16 : 12, isActive ? 32 : 24],
      popupAnchor: [0, isActive ? -32 : -24]
    }) : null;
  };

  // Initialize Leaflet Map
  if (window.L && mapEl) {
    try {
      leafletMap = L.map('districtMap', {
        center: [23.6850, 90.3563],
        zoom: 7,
        scrollWheelZoom: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap);

      setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
      }, 250);
    } catch (e) {
      console.warn('Map initialization note:', e);
    }
  }

  function selectOffice(o, panMap = true) {
    activeOfficeId = o.id;

    // Highlight card in list
    $$('.office-card-single').forEach(card => {
      const match = card.dataset.id === o.id;
      card.classList.toggle('active', match);
      if (match) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // Update marker pins and pan
    if (leafletMap) {
      markerInstances.forEach((marker, id) => {
        if (id === o.id) {
          if (marker.setIcon) marker.setIcon(createPinIcon(true));
          marker.openPopup();
          if (panMap) {
            leafletMap.flyTo([o.lat, o.lng], 11, { duration: 1.2 });
          }
        } else {
          if (marker.setIcon) marker.setIcon(createPinIcon(false));
        }
      });
    }
  }

  function renderListAndMarkers(q = '') {
    q = q.trim().toLowerCase();
    const matched = offices.filter(o => 
      !q || 
      (o.name || '').toLowerCase().includes(q) || 
      (o.district || '').toLowerCase().includes(q) || 
      (o.division || '').toLowerCase().includes(q) || 
      (o.address || '').toLowerCase().includes(q)
    );

    if (offCount) {
      offCount.textContent = `প্রদর্শন করা হচ্ছে: ${bnNum(matched.length)}টি অফিস`;
    }

    if (!matched.length) {
      offList.innerHTML = `<div class="empty-state" style="padding:2rem">কোনো জেলা বা অফিস পাওয়া যায়নি। অন্য জেলার নাম লিখে চেষ্টা করুন।</div>`;
      return;
    }

    offList.innerHTML = matched.map(o => `
      <div class="office-card-single ${activeOfficeId === o.id ? 'active' : ''}" data-id="${esc(o.id)}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <h3>🏛️ ${esc(o.name)}</h3>
          <span class="service-tag-badge" style="font-size:0.75rem">${esc(o.division || 'জেলা')} বিভাগ</span>
        </div>
        <div class="office-card-addr">📍 ${esc(o.address || o.district + ' জেলা জজ আদালত ভবন')}</div>
        <div class="office-card-meta">
          <span>🕒 <strong>সময়:</strong> ${esc(o.hours || 'রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা')}</span>
          <span>📞 <strong>হেল্পলাইন/ফোন:</strong> ${esc(o.phone || '১৬৬৯৯')}</span>
        </div>
        <div class="office-card-actions">
          <a class="btn-office-call" href="tel:${esc((o.phone || '16699').replace(/\D/g, ''))}">📞 সরাসরি কল</a>
          <a class="btn-office-apply" href="#/apply?district=${encodeURIComponent(o.district || '')}">📝 আবেদন দাখিল</a>
        </div>
      </div>
    `).join('');

    // Bind card clicks
    $$('.office-card-single', offList).forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        const targetId = card.dataset.id;
        const targetOffice = offices.find(x => x.id === targetId);
        if (targetOffice) selectOffice(targetOffice, true);
      });
    });

    // Update map markers
    if (leafletMap) {
      markerInstances.forEach(m => leafletMap.removeLayer(m));
      markerInstances.clear();

      matched.forEach(o => {
        if (!o.lat || !o.lng) return;
        const isAct = o.id === activeOfficeId;
        const marker = L.marker([o.lat, o.lng], { icon: createPinIcon(isAct) }).addTo(leafletMap);
        
        const popupHtml = `
          <div style="font-family:'Hind Siliguri',sans-serif;min-width:210px;padding:4px">
            <h4 style="margin:0 0 4px;color:#00543E;font-size:1.02rem">🏛️ ${esc(o.name)}</h4>
            <div style="font-size:0.84rem;color:#475569;margin-bottom:6px">📍 ${esc(o.address || o.district)}</div>
            <div style="font-size:0.85rem;color:#1E293B;margin-bottom:8px">📞 <strong>${esc(o.phone || '১৬৬৯৯')}</strong></div>
            <div style="display:flex;gap:6px">
              <a href="tel:${esc((o.phone || '16699').replace(/\D/g, ''))}" style="flex:1;text-align:center;padding:5px 8px;background:#F1F5F9;border:1px solid #CBD5E1;border-radius:4px;font-size:0.8rem;text-decoration:none;color:#00543E;font-weight:600">📞 কল</a>
              <a href="#/apply?district=${encodeURIComponent(o.district)}" style="flex:1;text-align:center;padding:5px 8px;background:#00543E;border-radius:4px;font-size:0.8rem;text-decoration:none;color:#fff;font-weight:600">আবেদন</a>
            </div>
          </div>
        `;
        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          selectOffice(o, false);
        });

        markerInstances.set(o.id, marker);
      });

      if (matched.length === 1) {
        selectOffice(matched[0], true);
      } else if (matched.length > 1 && !activeOfficeId) {
        leafletMap.setView([23.6850, 90.3563], 7);
      }
    }
  }

  renderListAndMarkers();

  if (offSearch) {
    let debounceTimer;
    offSearch.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderListAndMarkers(e.target.value);
      }, 150);
    });
  }
}

async function pageNews() {
  const news = (BOOT && BOOT.news) || [];
  app.innerHTML = `
  <div class="container page-head">
    <span class="section-tag">আপডেট ও বিজ্ঞপ্তি</span>
    <h1>📰 নিউজ, ইভেন্ট ও সার্কুলার</h1>
    <p>জাতীয় আইনগত সহায়তা প্রদান সংস্থা (NLASO)-র সাম্প্রতিক কার্যক্রম ও সংবাদ।</p>
  </div>
  <div class="container">
    <div class="news-grid">
      ${news.map(n => `
        <a class="news-card" href="#/news/${n.id}">
          <div class="news-card-img-wrap">
            <img class="news-card-img" src="${n.img}" alt="${esc(n.title)}" loading="lazy">
            <span class="news-card-tag">${esc(n.type === 'event' ? 'ইভেন্ট' : 'নিউজ')}</span>
          </div>
          <div class="news-card-body">
            <div class="news-card-date">📅 ${esc(n.date)}</div>
            <h3 class="news-card-title">${esc(n.title)}</h3>
            <p class="news-card-desc">${esc(n.body || '')}</p>
            <span class="news-card-link">বিস্তারিত পড়ুন →</span>
          </div>
        </a>
      `).join('')}
    </div>
  </div>`;
}

async function pageNewsDetail(id) {
  const n = ((BOOT && BOOT.news) || []).find(x => x.id === id);
  if (!n) return pageNews();
  app.innerHTML = `
  <div class="container page-head">
    <div class="breadcrumb"><a href="#/news">নিউজ ও ইভেন্ট</a> / ${esc(n.title)}</div>
    <h1>${esc(n.title)}</h1>
    <div style="color:var(--text-muted);font-size:0.9rem;margin-top:6px">প্রকাশের তারিখ: ${esc(n.date)}</div>
  </div>
  <div class="container" style="max-width:800px;margin-bottom:3rem">
    <img src="${n.img}" style="width:100%;border-radius:12px;margin-bottom:1.5rem" alt="${esc(n.title)}">
    <div style="font-size:1.05rem;line-height:1.7">${esc(n.body)}</div>
    <div style="margin-top:2rem">
      <a class="btn btn-outline" href="#/news">← সব নিউজে ফিরুন</a>
    </div>
  </div>`;
}

async function pageSearch() {
  app.innerHTML = `
  <div class="container page-head">
    <h1>🔍 সাইটে খুঁজুন</h1>
    <div class="search-bar" style="margin-top:1rem;max-width:100%">
      <input id="fullSearchQ" placeholder="যা খুঁজছেন লিখুন (যেমন: তালাক, দেনমোহর, জমি, জামিন, অফিস)...">
    </div>
  </div>
  <div class="container"><div id="fullSearchResults"></div></div>`;

  const doSearch = (q = '') => {
    q = q.trim().toLowerCase();
    if (!q) {
      $('#fullSearchResults').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">অনুসন্ধানের শব্দ লিখুন</div>';
      return;
    }
    const articles = (BOOT.articles || []).filter(a => (a.title + ' ' + (a.summary || '')).toLowerCase().includes(q));
    const offices = (BOOT.offices || []).filter(o => (o.name + ' ' + (o.district || '')).toLowerCase().includes(q));

    $('#fullSearchResults').innerHTML = `
      <h3>আর্টিকেল ও গাইড (${bnNum(articles.length)}টি)</h3>
      <div class="subtopic-grid" style="margin-bottom:2rem">
        ${articles.map(a => `
          <a class="subtopic-card" href="#/article/${a.id}">
            <h3 class="subtopic-card-title">${esc(a.title)}</h3>
            <p class="subtopic-card-desc">${esc(a.summary)}</p>
            <div class="subtopic-card-footer"><span>⏱️ ${esc(a.read)}</span><span>পড়ুন →</span></div>
          </a>
        `).join('') || '<p style="color:var(--text-muted)">কোনো আর্টিকেল মিলেনি।</p>'}
      </div>
      <h3>অফিস ডিরেক্টরি (${bnNum(offices.length)}টি)</h3>
      <div class="services-grid">
        ${offices.map(o => `
          <div class="service-card">
            <h3>🏛️ ${esc(o.name)}</h3>
            <p>${esc(o.address || '')}</p>
            <div>ফোন: ${esc(o.phone || '১৬৬৯৯')}</div>
          </div>
        `).join('') || '<p style="color:var(--text-muted)">কোনো অফিস মিলেনি।</p>'}
      </div>
    `;
  };

  $('#fullSearchQ').oninput = (e) => doSearch(e.target.value);
}

async function pageHelp() {
  pageHome();
  const el = document.querySelector('.channel-grid');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

async function pageHelpChannel(ch) {
  if (ch === 'ussd') openUssdSimulator();
  else pageHelp();
}

async function pageForm(id) {
  const f = ((BOOT && BOOT.articles) || []).find(a => a.id === id || a.formId === id);
  app.innerHTML = `
  <div class="container page-head">
    <div class="breadcrumb"><a href="#/topics">লাইব্রেরি</a> / ফরম পূরণ</div>
    <h1>📄 ${esc(f ? f.title : 'আইনি ফরম ও নোটিশ জেনারেটর')}</h1>
    <p>নিচের ফিল্ডগুলো পূরণ করলেই সঠিক আইনি ফরম্যাটে প্রিন্টযোগ্য দলিল তৈরি হবে।</p>
  </div>
  <div class="container">
    <div class="form-card" style="max-width:740px">
      <div class="field"><label>আবেদনকারীর নাম <span class="req">*</span></label><input id="doc_name" placeholder="আপনার পুরো নাম"></div>
      <div class="field" style="margin-top:1rem"><label>প্রতিপক্ষের নাম <span class="req">*</span></label><input id="doc_opp" placeholder="প্রতিপক্ষের পুরো নাম"></div>
      <div class="field" style="margin-top:1rem"><label>নোটিশের কারণ বা দাবি <span class="req">*</span></label><textarea id="doc_desc" placeholder="দাবি বা ঘটনার সংক্ষিপ্ত বিবরণ..."></textarea></div>
      <button class="btn btn-primary" id="btnGenDoc" style="margin-top:1.2rem">নোটিশ তৈরি করুন</button>
      <div id="docOutput" style="margin-top:1.5rem"></div>
    </div>
  </div>`;

  $('#btnGenDoc').onclick = () => {
    const name = $('#doc_name').value || 'আবেদনকারী';
    const opp = $('#doc_opp').value || 'প্রতিপক্ষ';
    const desc = $('#doc_desc').value || 'আইনি দাবিসমূহ';
    $('#docOutput').innerHTML = `
      <div style="background:#FFF;border:1px solid #000;padding:2rem;font-family:serif;line-height:1.8">
        <div style="text-align:center;font-weight:700;margin-bottom:1.5rem">আইনি নোটিশ / লিগ্যাল নোটিশ</div>
        <p><strong>প্রাপক:</strong> ${esc(opp)}</p>
        <p><strong>প্রেরক:</strong> ${esc(name)}</p>
        <p><strong>বিষয়:</strong> ${esc(desc)}</p>
        <p style="margin-top:1rem">এতদ্বারা আপনাকে জানানো যাইতেছে যে, উপরোক্ত বিষয়ে অত্র নোটিশ প্রাপ্তির ৩০ (ত্রিশ) দিনের মধ্যে বিষয়টি সমাধান না করিলে উপযুক্ত আদালতের আশ্রয় গ্রহণ করা হইবে।</p>
        <div style="margin-top:2rem;text-align:right">স্বাক্ষর: ${esc(name)}</div>
      </div>
      <button class="btn btn-outline" onclick="window.print()" style="margin-top:1rem">🖨️ প্রিন্ট করুন</button>
    `;
  };
}

async function pageArticle(id) {
  const a = ((BOOT && BOOT.articles) || []).find(x => x.id === id);
  if (!a) return pageTopics();
  app.innerHTML = `
  <div class="container page-head">
    <div class="breadcrumb"><a href="#/topics">লাইব্রেরি</a> / আর্টিকেল</div>
    <h1>${esc(a.title)}</h1>
    <div style="color:var(--text-muted);font-size:0.88rem;margin-top:6px">পড়ার সময়: ${esc(a.read || '৪ মিনিট')} · হালনাগাদ: ২০২৬</div>
  </div>
  <div class="container" style="max-width:800px;margin-bottom:3rem">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:2rem;line-height:1.8;font-size:1.05rem">
      <p style="font-weight:600;color:var(--gov-green);margin-bottom:1rem">${esc(a.summary)}</p>
      <div style="margin-top:1rem">${esc(a.body || 'এই বিষয়ে জেলা লিগ্যাল এইড অফিসে বিনামূল্যে পরামর্শ ও আইনগত সহায়তা পাওয়া যায়। বিস্তারিত তথ্যের জন্য টোল-ফ্রি ১৬৬৯৯ হেল্পলাইনে যোগাযোগ করুন।')}</div>
      <div style="margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;gap:12px;flex-wrap:wrap">
        <a class="btn btn-primary" href="#/apply">আইনি সহায়তা পেতে আবেদন করুন →</a>
        <a class="btn btn-outline" href="#/topics">আরও আর্টিকেল দেখুন</a>
      </div>
    </div>
  </div>`;
}

async function pageRegister() {
  pageLogin();
}

async function pageComplaint() {
  app.innerHTML = `
  <div class="container page-head">
    <span class="section-tag">জবাবদিহিতা</span>
    <h1>📢 অভিযোগ দাখিল</h1>
    <p>লিগ্যাল এইড সেবা নিয়ে কোনো অভিযোগ বা অনিয়ম পরিলক্ষিত হলে জানান। প্রতিটি অভিযোগ গুরুত্বের সাথে তদন্ত করা হয়।</p>
  </div>
  <div class="container">
    <div class="form-card" style="max-width:720px">
      <div class="field"><label>আপনার নাম ও মোবাইল নম্বর</label><input id="cmp_contact" placeholder="নাম ও ফোন"></div>
      <div class="field" style="margin-top:1rem"><label>অভিযোগের বিবরণ <span class="req">*</span></label><textarea id="cmp_desc" placeholder="কী ঘটেছে বিস্তারিত লিখুন..."></textarea></div>
      <button class="btn btn-primary" id="btnCmpSubmit" style="margin-top:1.2rem">অভিযোগ দাখিল করুন</button>
      <div id="cmpResult" style="margin-top:1rem"></div>
    </div>
  </div>`;

  $('#btnCmpSubmit').onclick = async () => {
    const desc = ($('#cmp_desc').value || '').trim();
    if (!desc) { toast('অভিযোগের বিবরণ লিখুন'); return; }
    $('#cmpResult').innerHTML = '<div style="background:var(--gov-green-surface);padding:1rem;border-radius:8px">✅ আপনার অভিযোগটি গ্রহণ করা হয়েছে (আইডি: CMP-2026-042)। ৩ কার্যদিবসের মধ্যে কর্তৃপক্ষ তদন্ত করবে।</div>';
  };
}

async function pageCall() {
  app.innerHTML = `
  <div class="container page-head">
    <h1>📞 ১৬৬৯৯ জাতীয় লিগ্যাল এইড কল সেন্টার</h1>
    <p>সরাসরি ফোনে আবেদন দাখিল ও তাত্ক্ষণিক পরামর্শ গ্রহণের সুবিধা।</p>
  </div>
  <div class="container" style="text-align:center;padding:3rem 0">
    <a class="btn btn-primary" href="tel:16699" style="font-size:1.3rem;padding:1rem 2.5rem;border-radius:50px">
      📞 ১৬৬৯৯ ডায়াল করুন (টোল-ফ্রি)
    </a>
  </div>`;
}

function renderAuthLink() {
  const el = $('#loginLink');
  if (!el) return;
  if (ME) {
    el.innerHTML = esc(ME.name || 'ড্যাশবোর্ড') + ' 👤';
    el.href = ME.role && ME.role !== 'applicant' && ME.role !== 'CITIZEN' ? '#/console' : '#/dashboard';
  } else {
    el.innerHTML = 'লগইন <span style="font-size:14px">👤</span>';
    el.href = '#/login';
  }
}

// ---------- ইনিশিয়ালাইজেশন ----------
(async function init() {
  initShell();
  try {
    BOOT = await apiGet('bootstrap');
  } catch (e) {
    console.error('Failed to load bootstrap data:', e);
  }
  renderAuthLink();
  await route();
})();
