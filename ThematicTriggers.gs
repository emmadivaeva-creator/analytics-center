/**
 * Read-only thematic Sendsay view for Analytics Center.
 * The canonical _Sendsay v2 table remains the single source of truth.
 * Only: portal_custom, portal_trigger_, portal_proverki-v-zakupkah_mcfr.
 * Excludes schools, other triggers, banners and legacy non-API reports.
 */
function getThematicTriggerReportsUi(offset, product, week, search) {
  const sheet = ensureSendsaySheet_(openStorage_());
  const last = sheet.getLastRow();
  const start = Math.max(0, Number(offset) || 0);
  const wantedProduct = String(product || '').trim();
  const wantedWeek = Number(week) || 0;
  const wantedQuery = String(search || '').trim().toLowerCase();
  const take = 200;
  const rows = [];
  const totals = {};
  let matching = 0;
  const allowed = {
    'ГЗ Система': true, 'ГФ Система': true,
    'ГЗ Периодика': true, 'ГФ Периодика': true
  };
  if (last > 1) {
    // Columns I:AH include Campaign ID, date, product, Campaign, metrics, DEMO R/Y/G.
    // Batch reads reduce Apps Script memory/time pressure.
    for (let first = 2; first <= last; first += 1500) {
      const values = sheet.getRange(first, 9, Math.min(1500, last - first + 1), 26).getDisplayValues();
      values.forEach(function(r) {
        const campaign = String(r[7] || '').trim();
        const itemProduct = String(r[4] || '').trim();
        const fileId = String(r[0] || '').trim();
        if (!isThematicPortalCampaign_(campaign) || !allowed[itemProduct]) return;
        if (!/^\d+$/.test(String(r[0] || ''))) return; // Campaign ID required
        // Only factual API imports; avoid duplicate/migration records.
        const date = String(r[1] || '').trim();
        const itemWeek = date ? isoWeek_(date) : 0;
        if (wantedProduct && itemProduct !== wantedProduct) return;
        if (wantedWeek && itemWeek !== wantedWeek) return;
        if (wantedQuery && (campaign + ' ' + r[9]).toLowerCase().indexOf(wantedQuery) < 0) return;
        const opened = number_(r[13]);
        const red = number_(r[23]), yellow = number_(r[24]), green = number_(r[25]);
        const demo = red + yellow + green;
        const label = itemProduct.replace('Периодика', 'ПЕР');
        const key = label + '|' + itemWeek;
        const agg = totals[key] || { product: label, week: itemWeek, campaigns: 0, opens: 0, demo: 0 };
        agg.campaigns++;
        agg.opens += opened;
        agg.demo += demo;
        totals[key] = agg;
        if (matching >= start && rows.length < take) {
          rows.push({
            id: String(r[0] || ''), date: date, week: itemWeek,
            product: label, campaign: campaign, subject: String(r[9] || ''),
            sendsay: String(r[8] || ''), sent: number_(r[10]),
            delivered: number_(r[11]), opens: opened, clicks: number_(r[15]),
            red: red, yellow: yellow, green: green, demo: demo
          });
        }
        matching++;
      });
    }
  }
  return {
    ok: true, rows: rows, offset: start, nextOffset: start + rows.length,
    done: start + rows.length >= matching, total: matching,
    totals: Object.keys(totals).map(function(k) { return totals[k]; })
      .sort(function(a,b) { return a.week - b.week || a.product.localeCompare(b.product); }),
    updatedAt: new Date().toISOString()
  };
}
