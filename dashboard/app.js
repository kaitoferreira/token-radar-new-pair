// New-Pair Radar dashboard: renders window.RADAR with no network.
//
// Views, all of the same page: the board, a protocol's detail view, and
// filtered views. The address carries the view, so a screenshot link opens
// exactly what it shows:
//   #/                    the board
//   #/protocol/<slug>     one protocol's detail view
//   #/?new=1              new pairs only (listed in the last 90 days)
//   #/?watchlist=1        the snapshot's watchlist only
(function () {
  'use strict';
  var R = window.RADAR;
  var rows = R.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  var $ = function (id) { return document.getElementById(id); };
  var state = { q: '', cat: '', chain: '', sort: 'implied', newOnly: false, wlOnly: false, view: 'board', detail: null };

  function fmtUsd(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return s;
  }
  function pctClass(v) { return v === null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
  function fmtAge(a) { return a === null ? '—' : a === 0 ? 'today' : a + 'd'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function ageBadge(r) {
    if (r.is_new_pair) return '<span class="badge new">NEW ' + r.age_days + 'd</span>';
    return '';
  }
  function wlBadge(r) {
    return r.on_watchlist ? '<span class="badge wl">WATCHLIST</span>' : '';
  }

  function renderMeta() {
    $('meta').innerHTML = 'Snapshot <b>' + esc(R.as_of) + '</b> · model <b>' + esc(R.model_version) + '</b><br>' +
      'Floor ' + fmtUsd(R.floor_usd) + ' · ' + R.board_size + ' rows';
    $('source').textContent = 'Source: ' + R.source + '. Snapshot data: DefiLlama public API, frozen at fetch; the radar reads it as given.';
  }

  function renderStats() {
    var med = rows.slice().sort(function (a, b) { return a.implied_value_usd - b.implied_value_usd; })[Math.floor(rows.length / 2)];
    var stats = [
      { k: 'Watchlist protocols', v: R.watchlist_size, dot: '#22B8D4' },
      { k: 'Board rows', v: R.board_size, dot: '#FAFAFA' },
      { k: 'New pairs (≤ 90 days)', v: R.new_pair_size, dot: '#22C55E' },
      { k: 'Median implied value', v: fmtUsd(med.implied_value_usd), dot: '#FBBF24' },
    ];
    $('stats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="k">' + s.k + '</div><div class="v"><span class="dot" style="background:' + s.dot + '"></span>' + s.v + '</div></div>';
    }).join('');
  }

  function renderStrip() {
    $('strip').innerHTML = R.new_pairs.map(function (r) {
      return '<div class="card" data-slug="' + esc(r.slug) + '">' +
        '<div class="nm">' + esc(r.name) + '<span class="badge age">' + r.age_days + 'd ago</span></div>' +
        '<div class="row2"><span>' + esc(r.category || 'Uncategorised') + '</span><span class="' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + ' 7d</span></div>' +
        '<div class="val">' + fmtUsd(r.implied_value_usd) + '</div>' +
        '<div class="row2"><span>TVL ' + fmtUsd(r.tvl_usd) + '</span><span>#' + r.rank + '</span></div></div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (el) {
      el.addEventListener('click', function () { location.hash = '#/protocol/' + el.getAttribute('data-slug'); });
    });
  }

  function renderFilters() {
    var cats = [], chains = [];
    rows.forEach(function (r) {
      if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
      r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
    });
    cats.sort(); chains.sort();
    $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.newOnly && !r.is_new_pair) return false;
      if (state.wlOnly && !r.on_watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.sort === 'tvl') list.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (state.sort === 'growth') list.sort(function (a, b) { return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d); });
    else if (state.sort === 'newest') list.sort(function (a, b) { return (a.age_days === null ? 1e9 : a.age_days) - (b.age_days === null ? 1e9 : b.age_days); });
    else list.sort(function (a, b) { return a.rank - b.rank; });
    return list;
  }

  function renderTable() {
    var list = filtered();
    var showBoard = state.view === 'board';
    $('board').hidden = !showBoard;
    $('liveTable').hidden = showBoard;
    $('tabBoard').classList.toggle('on', showBoard);
    $('tabLive').classList.toggle('on', !showBoard);
    if (!showBoard) {
      $('liveRows').innerHTML = R.live.map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td><td>' + esc(p.chains.slice(0, 3).join(', ') || '—') + '</td>' +
          '<td class="num">' + fmtUsd(p.tvl_usd) + '</td><td class="num">' + (p.mcap_usd === null ? '—' : fmtUsd(p.mcap_usd)) + '</td>' +
          '<td class="num ' + pctClass(p.change_7d) + '">' + fmtPct(p.change_7d) + '</td></tr>';
      }).join('');
      $('count').innerHTML = '<b>' + R.live.length + '</b> live-token protocols, shown at the market\u2019s own value — never mixed into the ranked board.';
      return;
    }
    $('rows').innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + ageBadge(r) + wlBadge(r) + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ') || '—') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + fmtUsd(r.implied_value_usd) + '</td>' +
        '<td class="num">×' + r.freshness_multiplier.toFixed(2) + '</td></tr>';
    }).join('');
    $('count').innerHTML = 'Showing <b>' + list.length + '</b> of ' + rows.length + ' ranked protocols' +
      (state.newOnly ? ' · new pairs only' : '') + (state.wlOnly ? ' · watchlist only' : '') + '. Click a row for its detail and farm plan.';
    Array.prototype.forEach.call(document.querySelectorAll('#rows tr'), function (el) {
      el.addEventListener('click', function () { location.hash = '#/protocol/' + el.getAttribute('data-slug'); });
    });
  }

  function renderDetail() {
    var wrap = $('detailWrap');
    var r = state.detail ? bySlug[state.detail] : null;
    document.body.classList.toggle('detail', !!r);
    if (!r) { wrap.hidden = true; $('detail').innerHTML = ''; return; }
    var base = Math.round(r.tvl_usd * R.model.base_multiple);
    var listed = r.listed_at ? 'first tracked ' + r.listed_at + ' (' + r.age_days + ' days before this snapshot)' : 'listing date not reported';
    wrap.hidden = false;
    $('detail').innerHTML =
      '<button class="dclose" id="dclose" type="button">Close</button>' +
      '<h2>' + esc(r.name) + ' <span class="faint">#' + r.rank + '</span></h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' · ' + listed + (r.is_new_pair ? ' — a new pair.' : '') + ' Records no token.</p>' +
      '<div class="dgrid">' +
      '<div class="dcell"><div class="k">Implied value</div><div class="v">' + fmtUsd(r.implied_value_usd) + '</div></div>' +
      '<div class="dcell"><div class="k">TVL</div><div class="v">' + fmtUsd(r.tvl_usd) + '</div></div>' +
      '<div class="dcell"><div class="k">7-day change</div><div class="v ' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</div></div>' +
      '<div class="dcell"><div class="k">Freshness</div><div class="v">×' + r.freshness_multiplier.toFixed(2) + '</div></div>' +
      '</div>' +
      '<div class="dformula">Model: <b>' + fmtUsd(base) + '</b> base (TVL × ' + R.model.base_multiple + ') × <b>' + r.growth_multiplier.toFixed(2) + '</b> growth × <b>' +
      r.freshness_multiplier.toFixed(2) + '</b> freshness × <b>' + r.breadth_multiplier.toFixed(2) + '</b> breadth = <b>' + fmtUsd(r.implied_value_usd) + '</b>. ' +
      'The same function scores every row; no name is special-cased.</div>' +
      '<h2>How to farm it</h2>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    $('dclose').addEventListener('click', function () { location.hash = '#/'; });
  }

  function readHash() {
    var h = location.hash || '#/';
    var m = h.match(/^#\/protocol\/([A-Za-z0-9._-]+)/);
    if (m && bySlug[m[1]]) { state.detail = m[1]; }
    else if (h.indexOf('?new=1') >= 0) { state.newOnly = true; state.detail = null; }
    else if (h.indexOf('?watchlist=1') >= 0) { state.wlOnly = true; state.detail = null; }
    else { state.detail = null; }
    if (h.indexOf('?new=1') >= 0) { state.newOnly = true; $('newOnly').checked = true; }
    if (h.indexOf('?watchlist=1') >= 0) { state.wlOnly = true; $('wlOnly').checked = true; }
  }

  function renderAll() { renderTable(); renderDetail(); }

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderTable(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderTable(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderTable(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderTable(); });
  $('newOnly').addEventListener('change', function (e) { state.newOnly = e.target.checked; renderTable(); });
  $('wlOnly').addEventListener('change', function (e) { state.wlOnly = e.target.checked; renderTable(); });
  $('tabBoard').addEventListener('click', function () { state.view = 'board'; renderTable(); });
  $('tabLive').addEventListener('click', function () { state.view = 'live'; renderTable(); });
  window.addEventListener('hashchange', function () { readHash(); renderAll(); window.scrollTo(0, 0); });

  renderMeta();
  renderStats();
  renderStrip();
  renderFilters();
  readHash();
  renderAll();
})();
