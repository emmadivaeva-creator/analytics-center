/*
 * Hotfix for Analytics Center v2.
 * In «Планы на год» a row of plan values can contain 43/46/etc., which are also
 * valid week numbers. The first v2 parser could mistake such a Plan row for the
 * week-header row. Override the parser after global function declarations are loaded.
 */
readDemoPlans_ = function(demoSpreadsheet, observedWeeks) {
  const sheet = demoSpreadsheet.getSheetByName(APP.demoPlanSheet);
  if (!sheet) return {};

  const rows = sheet.getDataRange().getDisplayValues();
  const plans = {};
  let family = '';
  let weekColumns = {};

  for (let i = 0; i < rows.length; i++) {
    const first = norm_(rows[i][0]);

    if (first === 'школа') {
      family = 'Школа';
      weekColumns = {};
      continue;
    }
    if (first === 'система') {
      family = 'Система';
      weekColumns = {};
      continue;
    }
    if (first === 'периодика') {
      family = 'Периодика';
      weekColumns = {};
      continue;
    }
    if (!family) continue;

    const candidateWeeks = {};
    for (let column = 1; column < rows[i].length; column++) {
      const week = Number(rows[i][column]);
      if (observedWeeks[week]) candidateWeeks[column] = week;
    }

    // A week header is either explicitly «Неделя» or has an empty first cell.
    // Never interpret a row beginning with «План» as week numbers.
    if ((first === 'неделя' || first === '') && Object.keys(candidateWeeks).length >= 3) {
      weekColumns = candidateWeeks;
      continue;
    }

    const group = demoGroup_(rows[i][0]);
    if (!group || !Object.keys(weekColumns).length) continue;

    const planRow = rows[i + 1] || [];
    if (norm_(planRow[0]) !== 'план') continue;

    Object.keys(weekColumns).forEach(column => {
      const week = weekColumns[column];
      plans[group + ' ' + family + '|' + week] = number_(planRow[Number(column)]);
    });
  }

  return plans;
};
